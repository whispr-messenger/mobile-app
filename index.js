import { registerRootComponent } from 'expo';

if (typeof global.DOMException === 'undefined') {
  class DOMException extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = String(name || 'Error');
    }
  }
  global.DOMException = DOMException;
}

const App = require('./App').default;
registerRootComponent(App);
