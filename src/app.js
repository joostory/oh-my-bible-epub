const Database = require('better-sqlite3')
const Epub = require('epub-gen')
const path = require('path')
const fs = require('fs')
const handlebars = require('handlebars')


const bookTemplate = handlebars.compile(
  fs.readFileSync(path.join(__dirname, "templates", "book.hbs"), "utf-8")
)
const VERSIONS = ['GAE', 'NIV']

const db = new Database('assets/holybible.db', {readonly: true});
const versionStmt = db.prepare("select vcode, bcode, type, name, chapter_count from bibles where vcode=?")
const bibleStmt = db.prepare("select * from verses where vcode=? and bcode=? order by vnum asc")

VERSIONS.forEach(version => {
  console.log(`Build ${version}`)
  new Epub({
    tempDir: path.join(__dirname, "../build"),
    title: "Oh my Bible",
    content: versionStmt.all(version).map(bible => {
      let verses = bibleStmt.all(bible.vcode, bible.bcode)
      let list = []
      for (let i = 1 ; i <= bible.chapter_count ; i++) {
        list.push({
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
    output: path.join(__dirname, "../dist", `oh-my-bible-${version}.epub`)
  })
})

db.close()
