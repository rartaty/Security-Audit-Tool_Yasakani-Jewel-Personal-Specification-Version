'use strict';

function tokenize(value) {
  return String(value).split(/\s+/);
}

console.log(tokenize('hello world').length);
