// Every word on the developer's side (/login and the dashboard). English only. "{name}" and
// "{text}" are filled in by the page.
import type { LoginError } from '@/lib/auth/login';
import type { CreateProjectError } from '@/lib/projects/create';
import type { RecencyGroup } from '@/lib/tickets/recency';

export const adminCopy = {
  login: {
    pageTitle: 'Sign in',
    label: 'Access code',
    submit: 'Open dashboard',
    opening: 'Opening…',
    errors: {
      mismatch: "That access code didn't match.",
      locked: 'Too many attempts. Try again in 15 minutes.',
    } satisfies Record<LoginError, string>,
  },
  nav: {
    label: 'Dashboard',
    inbox: 'Inbox',
    inboxCount: '{count} open',
    done: 'Done',
    developerFallback: 'Developer',
    signOut: 'Sign out',
    open: 'Open menu',
  },
  clients: {
    pageTitle: { inbox: 'Inbox', done: 'Done' },
    search: 'Search clients',
    groups: { today: 'Today', yesterday: 'Yesterday', week: 'Previous 7 days', older: 'Older', waiting: 'Waiting for a first report' } satisfies Record<RecencyGroup | 'waiting', string>,
    noReports: 'No reports yet',
    openCount: '{count} open',
    noMatch: 'No clients match "{text}".',
    emptyInbox: "Every client's reports are done.",
    emptyDone: 'Clients with nothing open show up here.',
  },
  newProject: {
    title: 'New project',
    label: 'Project name',
    hint: 'Your client sees it at the top of their report page.',
    create: 'Create project',
    creating: 'Creating…',
    cancel: 'Cancel',
    errors: {
      nameShort: 'Add a name of at least 2 characters.',
      nameLong: 'Keep the name under 60 characters.',
    } satisfies Record<CreateProjectError, string>,
  },
  thread: {
    label: 'Reports from {name}',
    back: 'All clients',
    copyLink: 'Copy report link',
    linkCopied: 'Report link copied',
    tabs: { all: 'All', new: 'New', in_progress: 'In progress', done: 'Done' },
    tabsLabel: 'Filter by status',
    speaker: 'Client',
    followUpAdded: 'Added {time}',
    screenshotAlt: 'Screenshot from {name}',
    markdownCopied: 'Copied as Markdown',
    copyFailed: "Couldn't copy to the clipboard. Try again.",
    keys: { move: 'move', open: 'open', copy: 'copy as Markdown' },
  },
  card: {
    status: { new: 'New', in_progress: 'In progress', done: 'Done' },
    priority: { low: 'Low', medium: 'Medium', high: 'High' },
    whatHappens: 'What happens:',
    askClient: 'Ask client',
    askClientHint: 'Not enough detail to act on. Ask the client one question.',
    confidence: 'Confidence {value}',
    confidenceLabel: 'Confidence',
    unclear: 'not clear from the report',
    low: 'low',
    reading: 'Reading the screenshot…',
    failed: "Couldn't read the screenshot",
    interrupted: 'Interrupted by a restart.',
    failedError: 'Retry, or open the ticket for details.',
    retry: 'Retry',
    retrying: 'Retrying…',
    retryFailed: "Couldn't start the retry. Try again.",
    untitled: 'No title yet',
  },
  empty: {
    noProjectsTitle: 'No projects yet',
    noProjectsBody: 'Add a project to get a report link for your client.',
    noReportsTitle: 'No reports yet',
    noReportsBody: "Send this link to your client. Reports show up here the moment they're sent.",
    tab: { new: 'No new tickets', in_progress: 'Nothing in progress', done: 'Nothing done yet' },
    showAll: 'Show all',
  },
  ticket: {
    back: 'Back to chat',
    pageTitle: 'Ticket',
    comingNext: 'The screenshot and the ticket fields come with the next update.',
  },
  shell: {
    pageTitle: 'Chats',
  },
} as const;

/** Fills "{name}"-style slots. */
export function fillIn(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}
