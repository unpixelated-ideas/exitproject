import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ko from './locales/ko.json';
import { storage } from './services/storage';
void i18n.use(initReactI18next).init({ resources: { en: { translation: en }, ko: { translation: ko } }, lng: storage.read('language') === 'ko' ? 'ko' : 'en', fallbackLng: 'en', interpolation: { escapeValue: false } });
i18n.on('languageChanged', lng => { storage.write('language', lng); document.documentElement.lang = lng; document.documentElement.dir = i18n.dir(lng); });
document.documentElement.lang = i18n.language;
export default i18n;
