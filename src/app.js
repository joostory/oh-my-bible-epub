// const Database = require('better-sqlite3')
const sqlite3 = require('sqlite3').verbose()
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


async function getBibles(vcode) {
  return new Promise((resolve, reject) => {
    const bibleStmt = db.prepare("select vcode, bcode, type, name, chapter_count from bibles where vcode=?")
    bibleStmt.all([vcode], (err, rows) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows)
      }
    })
    bibleStmt.finalize()
  })
}

async function getVerses(vcode, bcode) {
  return new Promise((resolve, reject) => {
    const versesStmt = db.prepare("select * from verses where vcode=? and bcode=? order by vnum asc")
    versesStmt.all([vcode, bcode], (err, rows) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows)
      }
    })
    versesStmt.finalize()
  })
}


async function makeEpub(db) {
  await Promise.all(
    VERSIONS.map(async version => {
      console.log(`Build ${version.code}`)
      const bibles = await getBibles(version.code)

      let verseList = []
      let content = await Promise.all(
        bibles.map(async bible => {
          const verses = await getVerses(version.code, bible.bcode)
          console.log("bible", bible.name, bible.chapter_count, verses.length)

          let verseList = []
          for (let i = 1 ; i <= bible.chapter_count ; i++) {
            verseList.push({
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
              list: verseList
            })
          }
        })
      )

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
    
        content: content,
        output: path.join(DIST_DIR, `oh-my-bible-${version.code}.epub`),
        verbose: true
      })
      
    })
  )
  return "OK"
}

const db = new sqlite3.Database('assets/holybible.db', [sqlite3.OPEN_READONLY])
makeEpub(db)
  .finally(() => {
    console.log("Fianl")
    db.close()
  })
