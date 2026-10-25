// Every word on the client page. English only (Filip, 2026-10-17). The client side never
// mentions AI, tickets, extraction or WhatsApp. "{name}", "{project}", "{date}", "{count}", "{when}"
// and "{time}" are filled in by the page.
import type { ReportErrorCode } from '@/lib/reports/validate';

export const clientCopy = {
  pageTitle: 'Report a problem',
  header: {
    responseTime: 'Usually replies the same day',
    // Outside office hours: "Back tomorrow at 9:00", "Back Monday at 9:00".
    back: 'Back {when} at {time}',
  },
  // The block at the top of the conversation, always visible.
  intro: {
    greeting: "This is your direct line to {name} for anything that doesn't work.",
    fallbackName: 'the team',
    stepsLabel: 'How it works',
    steps: ['Screenshot', 'One sentence', 'We fix it, you follow the status here'],
    inProgressOne: '1 report in progress',
    inProgressMany: '{count} reports in progress',
  },
  list: {
    title: 'Your reports',
    newReport: 'New report',
    account: 'Client', // under the project name in the sidebar's account row
    help: 'Help', // the sidebar's only entry for the screenshot steps and contact
    close: 'Close',
  },
  welcome: {
    contact: {
      title: 'Contact',
      body: '{name} looks after {project}.',
      fallbackName: 'The team',
    },
  },
  composer: {
    label: 'What happened?',
    placeholder: 'What did you tap, and what happened instead?',
    attach: 'Add a screenshot',
    remove: 'Remove screenshot',
    preparing: 'Preparing the screenshot…',
    chipsLabel: 'Start with',
    chips: ["A button doesn't work", "A page won't load", 'Wrong information shown'],
    send: 'Send',
    sending: 'Sending…',
    slow: 'Still sending. Your screenshot and text stay here.',
    dropHint: 'Drop the screenshot here',
  },
  // One report's chat: the client can add text to it, or start a new report for something else.
  thread: {
    title: 'Your report, sent {date}',
  },
  followUp: {
    label: 'Add to this report',
    placeholder: 'Add something to this report',
    send: 'Send',
    sending: 'Sending…',
    added: 'Added {date}',
    announce: 'Added to your report.',
  },
  feed: {
    sent: 'Sent',
    copyLink: 'Copy link (works on this device)',
    linkCopied: 'Link copied',
  },
  report: {
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
    openScreenshot: 'Open your screenshot full size',
    closeScreenshot: 'Close',
    contactLine: 'Questions about this report? Email {email}',
    // One short line under each timeline step, in place of a "what happens next" block.
    stepLines: {
      new: 'The team reads it, usually the same day.',
      in_progress: 'Someone has started on it.',
      done: 'Fixed. If it still fails, send a new report.',
    },
  },
  help: {
    title: 'How to take a screenshot',
    // One step per entry; step 2 has a line per device.
    steps: [
      ['Open the screen that shows the problem.'],
      [
        'iPhone: press the side and volume-up buttons together.',
        'Android: press power and volume-down.',
        'Windows: press Win + Shift + S and select the area.',
        'Mac: press Cmd + Shift + 4.',
      ],
      ['Add it here: tap or click the image button next to the field, or paste it with Ctrl+V / Cmd+V.'],
    ],
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
    rateLimited: "We can't take more reports right now. Try again in an hour.",
    notFound: "This report link doesn't work anymore. Ask for a new one.",
    server: "Couldn't send the report. Check your connection and try again.",
    followUpEmpty: 'Write a few words before sending.',
  } satisfies Record<ReportErrorCode, string>,
};

export type ClientCopy = typeof clientCopy;

/** Fills "{name}"-style slots; a missing value leaves the slot's text out. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}
