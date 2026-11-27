import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { availableLanguages } from './data/languages';
import en from './locales/en.json';
import ko from './locales/ko.json';
import { storage } from './services/storage';

const requested = new URLSearchParams(location.hash.split('?')[1]).get('lang');
const stored = storage.read('language');
const initialLanguage = [requested, stored].find(
    (value): value is string => typeof value === 'string' && availableLanguages.has(value),
) ?? 'en';

void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ko: { translation: ko } },
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

function updateDocumentLanguage(language: string) {
    document.documentElement.lang = language;
    document.documentElement.dir = i18n.dir(language);
}

i18n.on('languageChanged', language => {
    storage.write('language', language);
    updateDocumentLanguage(language);
});
updateDocumentLanguage(initialLanguage);

export default i18n;
