/**
 * Tests for moderation API services
 * Covers: reportsAPI, sanctionsAPI, appealsAPI, rolesAPI, auditAPI
 */

// ─── Mocks ───────────────────────────────────────────────────────

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

jest.mock('../src/services/TokenService', () => ({
  TokenService: {
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
  },
}));

jest.mock('../src/services/AuthService', () => ({
  AuthService: {
    refreshTokens: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/services/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.test.com',
}));

import {
  reportsAPI,
  sanctionsAPI,
  appealsAPI,
  rolesAPI,
  auditAPI,
  conversationSanctionsAPI,
} from '../src/services/moderation/moderationApi';

// ─── Helpers ─────────────────────────────────────────────────────

const mockResponse = (data: any, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
};

beforeEach(() => {
  mockFetch.mockReset();
});

// ─── reportsAPI ──────────────────────────────────────────────────

describe('reportsAPI', () => {
  it('createReport sends POST with correct body', async () => {
    const report = { id: 'r1', category: 'spam', status: 'pending' };
    mockFetch.mockReturnValue(mockResponse({ data: report }));

    const result = await reportsAPI.createReport({
      reported_user_id: 'u2',
      category: 'spam',
      description: 'test',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test.com/messaging/api/v1/reports');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      reported_user_id: 'u2',
      category: 'spam',
      description: 'test',
    });
    expect(result).toEqual(report);
  });

  it('getMyReports sends GET with pagination', async () => {
    const reports = [{ id: 'r1' }, { id: 'r2' }];
    mockFetch.mockReturnValue(mockResponse({ data: reports }));

    const result = await reportsAPI.getMyReports(10, 5);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://api.test.com/messaging/api/v1/reports?limit=10&offset=5',
    );
    expect(result).toEqual(reports);
  });

  it('getReport fetches a single report by id', async () => {
    const report = { id: 'r1', status: 'pending' };
    mockFetch.mockReturnValue(mockResponse({ data: report }));

    const result = await reportsAPI.getReport('r1');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test.com/messaging/api/v1/reports/r1');
    expect(result).toEqual(report);
  });

  it('getReportQueue passes filter params', async () => {
    mockFetch.mockReturnValue(mockResponse({ data: [] }));

    await reportsAPI.getReportQueue({
      limit: 20,
      offset: 0,
      status: 'pending',
      category: 'spam',
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/reports/queue');
    expect(url).toContain('status=pending');
    expect(url).toContain('category=spam');
  });

  it('getReportStats fetches stats', async () => {
    const stats = { pending: 5, under_review: 2, resolved_today: 10 };
    mockFetch.mockReturnValue(mockResponse({ data: stats }));

    const result = await reportsAPI.getReportStats();
    expect(result).toEqual(stats);
  });

  it('resolveReport sends PUT with action and notes', async () => {
    const report = { id: 'r1', status: 'resolved_action' };
    mockFetch.mockReturnValue(mockResponse({ data: report }));

    await reportsAPI.resolveReport('r1', 'warn', 'User warned');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://api.test.com/messaging/api/v1/reports/r1/resolve',
    );
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({
      action: 'warn',
      notes: 'User warned',
    });
  });

  it('retries on 401 after token refresh', async () => {
    const report = { id: 'r1' };
    mockFetch
      .mockReturnValueOnce(
        mockResponse({ error: 'Unauthorized' }, 401),
      )
      .mockReturnValueOnce(mockResponse({ data: report }));

    const result = await reportsAPI.getReport('r1');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual(report);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValue(mockResponse('Not found', 404));

    await expect(reportsAPI.getReport('bad')).rejects.toThrow('HTTP 404');
  });
});

// ─── sanctionsAPI ────────────────────────────────────────────────

describe('sanctionsAPI', () => {
  it('getMySanctions fetches user sanctions', async () => {
    const sanctions = [{ id: 's1', type: 'warning', active: true }];
    mockFetch.mockReturnValue(mockResponse({ data: sanctions }));

    const result = await sanctionsAPI.getMySanctions();
    expect(result).toEqual(sanctions);
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://api.test.com/user/v1/sanctions/me',
    );
  });

  it('getAllActive passes pagination', async () => {
    mockFetch.mockReturnValue(mockResponse({ data: [] }));

    await sanctionsAPI.getAllActive(30, 10);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://api.test.com/user/v1/sanctions?limit=30&offset=10',
    );
  });

  it('createSanction sends POST', async () => {
    const sanction = { id: 's1', type: 'temp_ban' };
    mockFetch.mockReturnValue(mockResponse({ data: sanction }));

    await sanctionsAPI.createSanction({
      userId: 'u1',
      type: 'temp_ban',
      reason: 'Violation',
      expiresAt: '2026-05-01T00:00:00Z',
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test.com/user/v1/sanctions');
    expect(options.method).toBe('POST');
  });

  it('liftSanction sends PUT', async () => {
    mockFetch.mockReturnValue(
      mockResponse({ data: { id: 's1', active: false } }),
    );

    await sanctionsAPI.liftSanction('s1');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test.com/user/v1/sanctions/s1/lift');
    expect(options.method).toBe('PUT');
  });
});

// ─── appealsAPI ──────────────────────────────────────────────────

describe('appealsAPI', () => {
  it('getMyAppeals fetches user appeals', async () => {
    const appeals = [{ id: 'a1', status: 'pending' }];
    mockFetch.mockReturnValue(mockResponse({ data: appeals }));

    const result = await appealsAPI.getMyAppeals();
    expect(result).toEqual(appeals);
  });

  it('getAppealQueue passes pagination', async () => {
    mockFetch.mockReturnValue(mockResponse({ data: [] }));

    await appealsAPI.getAppealQueue(15, 5);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('limit=15');
    expect(url).toContain('offset=5');
  });

  it('createAppeal sends POST with correct body', async () => {
    mockFetch.mockReturnValue(
      mockResponse({ data: { id: 'a1', status: 'pending' } }),
    );

    await appealsAPI.createAppeal({
      sanctionId: 's1',
      reason: 'Unjust ban',
      evidence: { screenshot: 'url' },
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test.com/user/v1/appeals');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      sanctionId: 's1',
      reason: 'Unjust ban',
      evidence: { screenshot: 'url' },
      type: 'sanction',
    });
  });

  it('reviewAppeal sends PUT with status and notes', async () => {
    mockFetch.mockReturnValue(
      mockResponse({ data: { id: 'a1', status: 'accepted' } }),
    );

    await appealsAPI.reviewAppeal('a1', 'accepted', 'Valid appeal');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test.com/user/v1/appeals/a1/review');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({
      status: 'accepted',
      reviewerNotes: 'Valid appeal',
    });
  });
});

// ─── rolesAPI ────────────────────────────────────────────────────

describe('rolesAPI', () => {
  it('getMyRole fetches current user role', async () => {
    mockFetch.mockReturnValue(
      mockResponse({ data: { role: 'moderator' } }),
    );

    const result = await rolesAPI.getMyRole();
    expect(result).toEqual({ role: 'moderator' });
  });

  it('setRole sends PUT with new role', async () => {
    mockFetch.mockReturnValue(mockResponse({ data: { success: true } }));

    await rolesAPI.setRole('u1', 'admin');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test.com/user/v1/roles/u1');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ role: 'admin' });
  });
});

// ─── conversationSanctionsAPI ────────────────────────────────────

describe('conversationSanctionsAPI', () => {
  it('list fetches sanctions for a conversation', async () => {
    mockFetch.mockReturnValue(mockResponse({ data: [] }));

    await conversationSanctionsAPI.list('conv1');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://api.test.com/messaging/api/v1/conversations/conv1/sanctions',
    );
  });

  it('create sends POST', async () => {
    mockFetch.mockReturnValue(
      mockResponse({ data: { id: 'cs1', type: 'mute' } }),
    );

    await conversationSanctionsAPI.create('conv1', {
      user_id: 'u1',
      type: 'mute',
      reason: 'Spamming',
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
  });

  it('lift sends DELETE', async () => {
    mockFetch.mockReturnValue(mockResponse(null, 204));

    await conversationSanctionsAPI.lift('conv1', 'cs1');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/conversations/conv1/sanctions/cs1');
    expect(options.method).toBe('DELETE');
  });
});

// ─── auditAPI ────────────────────────────────────────────────────

describe('auditAPI', () => {
  it('getLogs passes query parameters', async () => {
    mockFetch.mockReturnValue(
      mockResponse({ data: [], total: 0 }),
    );

    await auditAPI.getLogs({
      limit: 50,
      actorId: 'u1',
      action: 'sanction_created',
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('limit=50');
    expect(url).toContain('actorId=u1');
    expect(url).toContain('action=sanction_created');
  });
});
