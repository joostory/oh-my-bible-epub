const Database = require('better-sqlite3')
const Epub = require('epub-gen')
const path = require('path')
const fs = require('fs')
const handlebars = require('handlebars')

const DIST_DIR = path.join(__dirname, "../dist")
const BUILD_DIR = path.join(__dirname, "../build")
const TEMPLATE_DIR = path.join(__dirname, "templates")
const bookTemplate = handlebars.compile(
  fs.readFileSync(path.join(TEMPLATE_DIR, "book.hbs"), "utf-8")
)
const CSS = fs.readFileSync(path.join(TEMPLATE_DIR, "template.css"), "utf-8")
const VERSIONS = [
  {
    code: 'GAE',
    name: '개역개정',
    lang: 'ko'
  },
  // {
  //   code:'NIV',
  //   name: 'NIV',
  //   lang: 'en'
  // }
]

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR)
}

const db = new Database('assets/holybible.db', {readonly: true});
const bibleStmt = db.prepare("select vcode, bcode, type, name, chapter_count from bibles where vcode=?")
const versesStmt = db.prepare("select * from verses where vcode=? and bcode=? order by vnum asc")

VERSIONS.map(version => {
  console.log(`Build ${version.code}`)
  new Epub({
    tempDir: BUILD_DIR,
    title: "Oh my Bible",
    author: 'GOD',
    publisher: 'GOD',
    lang: version.code == 'GAE'? 'ko':'en',
    tocTitle: version.name,
    cover: 'https://raw.githubusercontent.com/joostory/holybible/master/dist/images/holybible.png',
    css: CSS,

    customOpfTemplatePath: path.join(TEMPLATE_DIR, "content.opf.ejs"),
    customNcxTocTemplatePath: path.join(TEMPLATE_DIR, "toc.ncx.ejs"),
    customHtmlTocTemplatePath: path.join(TEMPLATE_DIR, "toc.xhtml.ejs"),

    content: bibleStmt.all(version.code).map(bible => {
      let verses = versesStmt.all(bible.vcode, bible.bcode)
      let list = []
      for (let i = 1 ; i <= bible.chapter_count ; i++) {
        list.push({
          cnum: i,
          title: i,
          verses: verses.filter(v => v.cnum == i)
        })
      }
  
      return {
        title: bible.name,
        data: bookTemplate({
          title: bible.name,
          id: bible.bcode,
          list: list
        })
      }
    }),
    output: path.join(DIST_DIR, `oh-my-bible-${version.code}.epub`),
    verbose: true
  })
})

db.close()
