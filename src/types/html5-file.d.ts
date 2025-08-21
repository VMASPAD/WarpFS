// Extend the HTML input element types to include directory attributes
declare global {
  namespace React {
    interface InputHTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
      webkitdirectory?: string;
      directory?: string;
    }
  }
}

export {};