import type { InterfaceLanguage } from '@/stores/language-store';
import { analyticsMessages } from './messages/analytics';
import { assessmentMessages } from './messages/assessment';
import { commonMessages } from './messages/common';
import { contentListMessages } from './messages/content-list';
import { dashboardMessages } from './messages/dashboard';
import { favoritesMessages } from './messages/favorites';
import { journalMessages } from './messages/journal';
import { libraryMessages } from './messages/library';
import { loginMessages } from './messages/login';
import { modulesMessages } from './messages/modules';
import { ollamaWarningMessages } from './messages/ollama-warning';
import { practiceFeaturesMessages } from './messages/practice-features';
import { reviewMessages } from './messages/review';
import { settingsMessages } from './messages/settings';
import { shadowReadingMessages } from './messages/shadow-reading';
import { sidebarMessages } from './messages/sidebar';
import { speakMessages } from './messages/speak';
import { tagManagementMessages } from './messages/tag-management';
import { wordbooksMessages } from './messages/wordbooks';

export const messages = {
  assessment: assessmentMessages,
  analytics: analyticsMessages,
  common: commonMessages,
  contentList: contentListMessages,
  sidebar: sidebarMessages,
  dashboard: dashboardMessages,
  favorites: favoritesMessages,
  journal: journalMessages,
  modules: modulesMessages,
  settings: settingsMessages,
  speak: speakMessages,
  library: libraryMessages,
  login: loginMessages,
  review: reviewMessages,
  tagManagement: tagManagementMessages,
  ollamaWarning: ollamaWarningMessages,
  practiceFeatures: practiceFeaturesMessages,
  shadowReading: shadowReadingMessages,
  wordbooks: wordbooksMessages,
} as const;

export type Namespace = keyof typeof messages;
type CanonicalNamespaces = {
  [K in Namespace]: (typeof messages)[K]['en'];
};

export type MessageKey<N extends Namespace> = keyof CanonicalNamespaces[N];

// The upstream app historically used `zh` as its second persisted locale code.
// This fork keeps that storage value for backward compatibility, but presents it
// as Vietnamese. Namespaces not translated to Vietnamese yet intentionally fall
// back to English so the UI never mixes Vietnamese with Chinese.
const VIETNAMESE_NAMESPACES = new Set<Namespace>(['common', 'sidebar']);

function resolveMessages<N extends Namespace>(language: InterfaceLanguage, namespace: N): CanonicalNamespaces[N] {
  const localized = messages[namespace] as unknown as Record<string, CanonicalNamespaces[N]>;
  const locale = language === 'zh' && !VIETNAMESE_NAMESPACES.has(namespace) ? 'en' : language;
  return localized[locale] ?? localized.en;
}

function formatMessage(template: string, values?: Record<string, string | number>) {
  if (!values) return template;

  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
}

export function getMessage<N extends Namespace, K extends MessageKey<N>>(
  language: InterfaceLanguage,
  namespace: N,
  key: K,
): CanonicalNamespaces[N][K] {
  const localized = resolveMessages(language, namespace);
  const english = messages[namespace].en as CanonicalNamespaces[N];
  return (localized[key] ?? english[key]) as CanonicalNamespaces[N][K];
}

export function translate<N extends Namespace, K extends MessageKey<N>>(
  language: InterfaceLanguage,
  namespace: N,
  key: K,
  values?: Record<string, string | number>,
) {
  const message = getMessage(language, namespace, key);

  if (typeof message === 'string') {
    return formatMessage(message, values);
  }

  return message;
}

export type DictionaryShape = {
  [K in Namespace]: CanonicalNamespaces[K];
};

export function getLanguageMessages(language: InterfaceLanguage): DictionaryShape {
  return Object.fromEntries(
    (Object.keys(messages) as Namespace[]).map((namespace) => [namespace, resolveMessages(language, namespace)]),
  ) as DictionaryShape;
}
