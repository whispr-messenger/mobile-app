import type { Contact, ContactSearchParams } from "../types/contact";

const toLowerOrEmpty = (v: unknown): string =>
  v == null ? "" : String(v).toLowerCase();

const contactMatchesQuery = (contact: Contact, query: string): boolean => {
  const fields = [
    contact.nickname,
    contact.contact_user?.username,
    contact.contact_user?.first_name,
    contact.contact_user?.last_name,
    contact.contact_user?.phone_number,
    contact.contact_user?.phone_number_masked,
  ];
  return fields.some((field) => toLowerOrEmpty(field).includes(query));
};

const compareByName = (a: Contact, b: Contact): number => {
  const left = toLowerOrEmpty(a.nickname ?? a.contact_user?.username);
  const right = toLowerOrEmpty(b.nickname ?? b.contact_user?.username);
  return left.localeCompare(right, "fr");
};

const compareByAddedDesc = (a: Contact, b: Contact): number =>
  new Date(b.added_at).getTime() - new Date(a.added_at).getTime();

const compareByLastSeenDesc = (a: Contact, b: Contact): number =>
  new Date(b.contact_user?.last_seen ?? 0).getTime() -
  new Date(a.contact_user?.last_seen ?? 0).getTime();

const compareByFavoriteThenName = (a: Contact, b: Contact): number =>
  Number(b.is_favorite) - Number(a.is_favorite) || compareByName(a, b);

const SORTERS: Record<
  NonNullable<ContactSearchParams["sort"]>,
  (a: Contact, b: Contact) => number
> = {
  added_at: compareByAddedDesc,
  last_seen: compareByLastSeenDesc,
  favorites: compareByFavoriteThenName,
  name: compareByName,
};

/**
 * Filter + sort contacts for the contacts list screen.
 *
 * Order of operations: filter-by-favorites → filter-by-query → sort.
 * Returns a new array (never mutates the input).
 */
export const filterAndSortContacts = (
  contacts: Contact[],
  searchQuery: string,
  sortBy: ContactSearchParams["sort"] | undefined,
  showFavoritesOnly: boolean,
): Contact[] => {
  let list = showFavoritesOnly
    ? contacts.filter((c) => c.is_favorite)
    : [...contacts];

  const query = searchQuery.trim().toLowerCase();
  if (query) {
    list = list.filter((c) => contactMatchesQuery(c, query));
  }

  const sorter = SORTERS[sortBy ?? "name"] ?? compareByName;
  list.sort(sorter);
  return list;
};
