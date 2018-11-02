import { Url, URL } from "url";

class Highlight {
  filename: string | undefined;
  title: string | undefined;
  postUrl: Url | undefined;
  date: Date | undefined;
  permalink: string | undefined;
  video: string | undefined;
  excerpt: string | undefined;

  constructor(initObject: any) {
    this.filename = initObject.filename || "";
    this.title = initObject.title || "";
    this.postUrl = initObject.postUrl || new URL("https://google.com");
    this.date = initObject.date || new Date();
    this.permalink = initObject.permalink || "";
    this.video = initObject.video || "";
    this.excerpt = initObject.excerpt || "";
  }
}

export default Highlight;
