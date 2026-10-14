# Third-party content

The MIT license covers the original application code. It does not relicense Wikipedia content, Wikimedia images, or third-party dependencies.

`public/catalog.json` contains English Wikipedia article titles, descriptions, excerpts, and source URLs. Wikipedia text is available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Each record links to its source article, whose history identifies the contributors. The importer normalizes whitespace and may shorten excerpts; manually assigned topic categories are application metadata.

Images are loaded from Wikimedia. They retain their individual licenses; the `imageFile` field and the app's image-source links identify the corresponding file page, author, and license. Image exports use resized thumbnails. Consult those source pages when reusing exported images.

Dependencies retain their own licenses, included in their distributed packages. This project is not affiliated with the Wikimedia Foundation.
