"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url_1 = require("url");
class Highlight {
  constructor(initObject) {
    this.filename = initObject.filename || "";
    this.title = initObject.title || "";
    this.postUrl = initObject.postUrl || new url_1.URL("https://google.com");
    this.date = initObject.date || new Date();
    this.permalink = initObject.permalink || "";
    this.video = initObject.video || "";
    this.excerpt = initObject.excerpt || "";
  }
}
exports.default = Highlight;
