// Every word on the client report page, per language. Bosnian is the default: Filip's clients
// are local. English is kept complete so a project can switch later; tests check that both
// languages have the same keys and words for every error code. The dashboard stays English.
import type { ReportErrorCode } from '@/lib/reports/validate';

export const CLIENT_LOCALES = ['bs', 'en'] as const;
export type ClientLocale = (typeof CLIENT_LOCALES)[number];
export const DEFAULT_CLIENT_LOCALE: ClientLocale = 'bs';

export type ClientCopy = {
  pageTitle: string;
  subtitle: string;
  screenshot: { add: string; hintTouch: string; hintPointer: string; replace: string; alt: string };
  sentence: { label: string; hint: string; placeholder: string };
  send: string;
  sending: string;
  reassurance: string;
  sent: { badge: string; heading: string; close: string; another: string; footer: string };
  notFound: { heading: string; body: string };
  errors: Record<ReportErrorCode, string>;
};

export const clientCopy: Record<ClientLocale, ClientCopy> = {
  bs: {
    pageTitle: 'Prijavite problem',
    subtitle: 'Prijavite problem',
    screenshot: {
      add: 'Dodajte snimak ekrana',
      hintTouch: 'Dodirnite da izaberete iz galerije ili uslikate',
      hintPointer: 'Prevucite snimak ekrana ovdje ili kliknite da izaberete',
      replace: 'Zamijeni',
      alt: 'Vaš snimak ekrana',
    },
    sentence: {
      label: 'Šta se desilo?',
      hint: 'Dovoljna je jedna rečenica.',
      placeholder: 'npr. Kliknula sam Sačuvaj na terminu i ništa se nije desilo.',
    },
    send: 'Pošalji prijavu',
    sending: 'Šaljem…',
    reassurance: 'Bez registracije. Javićemo vam se na WhatsApp ako trebamo više informacija.',
    sent: {
      badge: 'Poslano',
      heading: 'Primljeno. Vaš programer će to pogledati.',
      close: 'Možete zatvoriti ovu stranicu.',
      another: 'Pošalji još jednu prijavu',
      footer: 'Poslano putem Snaga',
    },
    notFound: {
      heading: 'Ovaj link ne otvara stranicu',
      body: 'Provjerite link ili zatražite novi od osobe koja vam ga je poslala.',
    },
    errors: {
      sentenceShort: 'Napišite bar 10 znakova o tome šta se desilo.',
      sentenceLong: 'Skratite opis na manje od 1000 znakova.',
      missingImage: 'Dodajte snimak ekrana prije slanja.',
      invalidType: 'Izaberite PNG, JPG ili WebP sliku.',
      tooLarge: 'Izaberite sliku manju od 5 MB.',
      tooManyPixels: 'Izaberite manju sliku.',
      oneFile: 'Izaberite jedan snimak ekrana.',
      rateLimited: 'Previše prijava s ovog uređaja u posljednjih sat vremena. Pokušajte kasnije.',
      notFound: 'Ovaj link za prijavu više ne radi. Zatražite novi.',
      server: 'Prijava nije poslana. Provjerite internet vezu i pokušajte ponovo.',
    },
  },
  en: {
    pageTitle: 'Report a problem',
    subtitle: 'Report a problem',
    screenshot: {
      add: 'Add a screenshot',
      hintTouch: 'Tap to choose from your photos or take one',
      hintPointer: 'Drop a screenshot here or click to choose',
      replace: 'Replace',
      alt: 'Your screenshot',
    },
    sentence: {
      label: 'What happened?',
      hint: 'One sentence is enough.',
      placeholder: 'e.g. I tapped Save on the appointment and nothing happened.',
    },
    send: 'Send report',
    sending: 'Sending…',
    reassurance: "No sign-up. We'll reach out on WhatsApp if we need more details.",
    sent: {
      badge: 'Sent',
      heading: 'Received. Your developer will take a look.',
      close: 'You can close this page.',
      another: 'Send another report',
      footer: 'Sent with Snag',
    },
    notFound: {
      heading: "This link doesn't open a page",
      body: 'Check the link, or ask the person who sent it for a new one.',
    },
    errors: {
      sentenceShort: 'Write at least 10 characters about what happened.',
      sentenceLong: 'Keep it under 1000 characters.',
      missingImage: 'Add a screenshot before sending.',
      invalidType: 'Choose a PNG, JPG or WebP image.',
      tooLarge: 'Choose an image under 5 MB.',
      tooManyPixels: 'Choose a smaller image.',
      oneFile: 'Choose one screenshot.',
      rateLimited: 'Too many reports from this device in the last hour. Try again later.',
      notFound: "This report link doesn't work anymore. Ask for a new one.",
      server: "Couldn't send the report. Check your connection and try again.",
    },
  },
};
