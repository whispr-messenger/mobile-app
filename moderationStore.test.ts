/**
 * Tests for moderation Zustand store
 * Covers: role fetching, data fetching, actions, error handling
 */

// ─── Mocks ───────────────────────────────────────────────────────

const mockGetMyRole = jest.fn();
const mockGetMyReports = jest.fn();
const mockGetMySanctions = jest.fn();
const mockGetMyAppeals = jest.fn();
const mockGetReportQueue = jest.fn();
const mockGetAppealQueue = jest.fn();
const mockGetReportStats = jest.fn();
const mockResolveReport = jest.fn();
const mockReviewAppeal = jest.fn();
const mockCreateAppeal = jest.fn();

jest.mock('./src/services/moderation/moderationApi', () => ({
  reportsAPI: {
    getMyReports: (...args: any[]) => mockGetMyReports(...args),
    getReportQueue: (...args: any[]) => mockGetReportQueue(...args),
    getReportStats: (...args: any[]) => mockGetReportStats(...args),
    resolveReport: (...args: any[]) => mockResolveReport(...args),
  },
  sanctionsAPI: {
    getMySanctions: (...args: any[]) => mockGetMySanctions(...args),
  },
  appealsAPI: {
    getMyAppeals: (...args: any[]) => mockGetMyAppeals(...args),
    getAppealQueue: (...args: any[]) => mockGetAppealQueue(...args),
    reviewAppeal: (...args: any[]) => mockReviewAppeal(...args),
    createAppeal: (...args: any[]) => mockCreateAppeal(...args),
  },
  rolesAPI: {
    getMyRole: (...args: any[]) => mockGetMyRole(...args),
  },
}));

import { useModerationStore } from './src/store/moderationStore';
import { act } from '@testing-library/react-native';

// ─── Helpers ─────────────────────────────────────────────────────

beforeEach(() => {
  // Reset store between tests
  useModerationStore.getState().reset();
  jest.clearAllMocks();
});

// ─── fetchMyRole ─────────────────────────────────────────────────

describe('fetchMyRole', () => {
  it('sets role to admin and flags isAdmin + isModerator', async () => {
    mockGetMyRole.mockResolvedValue({ role: 'admin' });

    await act(async () => {
      await useModerationStore.getState().fetchMyRole();
    });

    const state = useModerationStore.getState();
    expect(state.role).toBe('admin');
    expect(state.isAdmin).toBe(true);
    expect(state.isModerator).toBe(true);
  });

  it('sets role to moderator: isAdmin false, isModerator true', async () => {
    mockGetMyRole.mockResolvedValue({ role: 'moderator' });

    await act(async () => {
      await useModerationStore.getState().fetchMyRole();
    });

    const state = useModerationStore.getState();
    expect(state.role).toBe('moderator');
    expect(state.isAdmin).toBe(false);
    expect(state.isModerator).toBe(true);
  });

  it('sets role to user: both flags false', async () => {
    mockGetMyRole.mockResolvedValue({ role: 'user' });

    await act(async () => {
      await useModerationStore.getState().fetchMyRole();
    });

    const state = useModerationStore.getState();
    expect(state.role).toBe('user');
    expect(state.isAdmin).toBe(false);
    expect(state.isModerator).toBe(false);
  });

  it('sets error on failure', async () => {
    mockGetMyRole.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      await useModerationStore.getState().fetchMyRole();
    });

    expect(useModerationStore.getState().error).toBe('Network error');
  });
});

// ─── fetchMyReports ──────────────────────────────────────────────

describe('fetchMyReports', () => {
  it('fetches and stores reports', async () => {
    const reports = [
      { id: 'r1', status: 'pending' },
      { id: 'r2', status: 'resolved_action' },
    ];
    mockGetMyReports.mockResolvedValue(reports);

    await act(async () => {
      await useModerationStore.getState().fetchMyReports();
    });

    const state = useModerationStore.getState();
    expect(state.myReports).toEqual(reports);
    expect(state.loading).toBe(false);
  });

  it('sets loading during fetch', async () => {
    let resolvePromise: (value: any) => void;
    mockGetMyReports.mockReturnValue(
      new Promise((r) => {
        resolvePromise = r;
      }),
    );

    const promise = act(async () => {
      useModerationStore.getState().fetchMyReports();
    });

    // loading should be true while fetching
    expect(useModerationStore.getState().loading).toBe(true);

    await act(async () => {
      resolvePromise!([]);
    });
    await promise;
  });

  it('sets error on failure', async () => {
    mockGetMyReports.mockRejectedValue(new Error('Fetch failed'));

    await act(async () => {
      await useModerationStore.getState().fetchMyReports();
    });

    const state = useModerationStore.getState();
    expect(state.error).toBe('Fetch failed');
    expect(state.loading).toBe(false);
  });
});

// ─── fetchMySanctions ────────────────────────────────────────────

describe('fetchMySanctions', () => {
  it('fetches and stores sanctions', async () => {
    const sanctions = [{ id: 's1', type: 'warning', active: true }];
    mockGetMySanctions.mockResolvedValue(sanctions);

    await act(async () => {
      await useModerationStore.getState().fetchMySanctions();
    });

    expect(useModerationStore.getState().mySanctions).toEqual(sanctions);
  });
});

// ─── fetchMyAppeals ──────────────────────────────────────────────

describe('fetchMyAppeals', () => {
  it('fetches and stores appeals', async () => {
    const appeals = [{ id: 'a1', status: 'pending' }];
    mockGetMyAppeals.mockResolvedValue(appeals);

    await act(async () => {
      await useModerationStore.getState().fetchMyAppeals();
    });

    expect(useModerationStore.getState().myAppeals).toEqual(appeals);
  });
});

// ─── Admin queues ────────────────────────────────────────────────

describe('fetchReportQueue', () => {
  it('fetches report queue', async () => {
    const queue = [{ id: 'r1', status: 'pending' }];
    mockGetReportQueue.mockResolvedValue(queue);

    await act(async () => {
      await useModerationStore.getState().fetchReportQueue();
    });

    expect(useModerationStore.getState().reportQueue).toEqual(queue);
  });
});

describe('fetchAppealQueue', () => {
  it('fetches appeal queue', async () => {
    const queue = [{ id: 'a1', status: 'pending' }];
    mockGetAppealQueue.mockResolvedValue(queue);

    await act(async () => {
      await useModerationStore.getState().fetchAppealQueue();
    });

    expect(useModerationStore.getState().appealQueue).toEqual(queue);
  });
});

describe('fetchStats', () => {
  it('fetches and stores stats', async () => {
    const stats = {
      pending: 5,
      under_review: 2,
      resolved_today: 10,
      by_category: { spam: 3, offensive: 2 },
    };
    mockGetReportStats.mockResolvedValue(stats);

    await act(async () => {
      await useModerationStore.getState().fetchStats();
    });

    expect(useModerationStore.getState().stats).toEqual(stats);
  });
});

// ─── resolveReport ───────────────────────────────────────────────

describe('resolveReport', () => {
  it('calls API and refreshes queue + stats', async () => {
    mockResolveReport.mockResolvedValue({});
    mockGetReportQueue.mockResolvedValue([]);
    mockGetReportStats.mockResolvedValue({ pending: 0 });

    await act(async () => {
      await useModerationStore
        .getState()
        .resolveReport('r1', 'warn', 'Final warning');
    });

    expect(mockResolveReport).toHaveBeenCalledWith('r1', 'warn', 'Final warning');
    // Should trigger refresh of queue and stats
    expect(mockGetReportQueue).toHaveBeenCalled();
    expect(mockGetReportStats).toHaveBeenCalled();
  });

  it('sets error on failure', async () => {
    mockResolveReport.mockRejectedValue(new Error('Resolve failed'));

    await act(async () => {
      await useModerationStore.getState().resolveReport('r1', 'warn');
    });

    expect(useModerationStore.getState().error).toBe('Resolve failed');
  });
});

// ─── reviewAppeal ────────────────────────────────────────────────

describe('reviewAppeal', () => {
  it('calls API and refreshes appeal queue', async () => {
    mockReviewAppeal.mockResolvedValue({});
    mockGetAppealQueue.mockResolvedValue([]);

    await act(async () => {
      await useModerationStore
        .getState()
        .reviewAppeal('a1', 'accepted', 'Valid');
    });

    expect(mockReviewAppeal).toHaveBeenCalledWith('a1', 'accepted', 'Valid');
    expect(mockGetAppealQueue).toHaveBeenCalled();
  });
});

// ─── createAppeal ────────────────────────────────────────────────

describe('createAppeal', () => {
  it('calls API and refreshes appeals + sanctions', async () => {
    mockCreateAppeal.mockResolvedValue({});
    mockGetMyAppeals.mockResolvedValue([]);
    mockGetMySanctions.mockResolvedValue([]);

    await act(async () => {
      await useModerationStore
        .getState()
        .createAppeal('s1', 'Unfair ban', { screenshot: 'url' });
    });

    expect(mockCreateAppeal).toHaveBeenCalledWith({
      sanctionId: 's1',
      reason: 'Unfair ban',
      evidence: { screenshot: 'url' },
    });
    expect(mockGetMyAppeals).toHaveBeenCalled();
    expect(mockGetMySanctions).toHaveBeenCalled();
  });
});

// ─── reset ───────────────────────────────────────────────────────

describe('reset', () => {
  it('resets all state to initial values', async () => {
    // Set some state first
    mockGetMyRole.mockResolvedValue({ role: 'admin' });
    await act(async () => {
      await useModerationStore.getState().fetchMyRole();
    });
    expect(useModerationStore.getState().isAdmin).toBe(true);

    // Reset
    act(() => {
      useModerationStore.getState().reset();
    });

    const state = useModerationStore.getState();
    expect(state.role).toBe('user');
    expect(state.isAdmin).toBe(false);
    expect(state.isModerator).toBe(false);
    expect(state.myReports).toEqual([]);
    expect(state.mySanctions).toEqual([]);
    expect(state.myAppeals).toEqual([]);
    expect(state.reportQueue).toEqual([]);
    expect(state.appealQueue).toEqual([]);
    expect(state.stats).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });
});
