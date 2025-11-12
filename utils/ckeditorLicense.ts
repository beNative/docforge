declare global {
  interface Window {
    CKEDITOR_LICENSE_KEY?: string;
    CKEDITOR_GLOBAL_LICENSE_KEY?: string;
  }
}

export const resolveCkeditorLicenseKey = (): string => {
  if (typeof window === 'undefined') {
    return 'GPL';
  }

  if (typeof window.CKEDITOR_GLOBAL_LICENSE_KEY !== 'string' || window.CKEDITOR_GLOBAL_LICENSE_KEY.trim() === '') {
    window.CKEDITOR_GLOBAL_LICENSE_KEY = 'GPL';
  }

  if (typeof window.CKEDITOR_LICENSE_KEY !== 'string' || window.CKEDITOR_LICENSE_KEY.trim() === '') {
    window.CKEDITOR_LICENSE_KEY = window.CKEDITOR_GLOBAL_LICENSE_KEY;
  }

  return window.CKEDITOR_LICENSE_KEY;
};

export const CKEDITOR_LICENSE_KEY = resolveCkeditorLicenseKey();
