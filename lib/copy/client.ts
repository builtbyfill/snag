// Every word on the client page. English only (Filip, 2026-10-17). The client side never
// mentions AI, tickets, extraction or WhatsApp. "{name}", "{project}" and "{date}" are filled in by the page.
import type { ReportErrorCode } from '@/lib/reports/validate';

export const clientCopy = {
  pageTitle: 'Report a problem',
  header: {
    responseTime: 'Usually replies the same day',
  },
  list: {
    title: 'Your reports',
    newReport: 'New report',
    groups: { open: 'In progress', done: 'Done' },
  },
  welcome: {
    how: {
      title: 'How it works',
      body: 'Take a screenshot of the screen where it went wrong, then say in one sentence what you did and what happened.',
    },
    next: {
      title: 'What happens next',
      body: 'The status moves from Received to In progress to Done on this page. Keep the link to check back.',
    },
    contact: {
      title: 'Contact',
      body: '{name} looks after {project}.',
      fallbackName: 'The team',
    },
  },
  newReport: {
    title: 'New report',
    intro: 'One screenshot and one sentence is enough.',
    back: 'Your reports',
    attach: 'Add a screenshot',
    attachHint: 'From your photos or files',
    pasteHint: 'You can also paste or drop it here',
    replace: 'Replace',
    remove: 'Remove screenshot',
    preparing: 'Preparing the screenshot…',
    sentenceLabel: 'What happened?',
    placeholder: 'e.g. I tapped Save on the appointment and nothing happened.',
    chipsLabel: 'Start with',
    chips: ["A button doesn't work", "A page won't load", 'Wrong information shown'],
    send: 'Send report',
    sending: 'Sending…',
    slow: 'Still sending. Your screenshot and text stay here.',
    reassurance: 'No sign-up needed. The team will get back to you if they need more details.',
    dropHint: 'Drop the screenshot here',
  },
  report: {
    back: 'Your reports',
    sentOn: 'Sent {date}',
    headline: {
      new: 'Report received',
      in_progress: 'The team is working on it',
      done: 'The team has finished this',
    },
    detail: {
      new: 'The team will take a look. The status changes on this page.',
      in_progress: 'Nothing else is needed from you.',
      done: "If it still isn't working, send a new report.",
    },
    progressLabel: 'Progress',
    announce: 'Report sent.',
  },
  status: { new: 'Received', in_progress: 'In progress', done: 'Done' },
  screenshotAlt: 'Your screenshot',
  notFound: {
    heading: "This report link doesn't work",
    body: 'Check the link, or ask the person who sent it for a new one.',
  },
  errors: {
    sentenceShort: 'Add a few words about what you tapped and what happened.',
    sentenceLong: 'Keep it under 1000 characters.',
    missingImage: 'Add a screenshot before sending.',
    invalidType: "This isn't an image. Choose a screenshot or a photo.",
    unreadableImage: "This image can't be opened. Try another one.",
    tooLarge: 'This image is too large. Try another one.',
    tooManyPixels: 'This image is too large. Try another one.',
    oneFile: 'Choose one screenshot.',
    rateLimited: 'Too many reports from this device in the last hour. Try again in an hour.',
    notFound: "This report link doesn't work anymore. Ask for a new one.",
    server: "Couldn't send the report. Check your connection and try again.",
  } satisfies Record<ReportErrorCode, string>,
};

export type ClientCopy = typeof clientCopy;

/** Fills "{name}"-style slots; a missing value leaves the slot's text out. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}
