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

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR)
}

async function getVersions() {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare("select vcode, name from versions")
    stmt.all((err, rows) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows)
      }
    })
    stmt.finalize()
  })
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
  const versions = await getVersions()
  await Promise.all(
    versions.map(async version => {
      console.log(`Build ${version.vcode}`)
      const bibles = await getBibles(version.vcode)

      let content = await Promise.all(
        bibles.map(async bible => {
          const verses = await getVerses(version.vcode, bible.bcode)
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
        lang: version.vcode == 'GAE'? 'ko':'en',
        tocTitle: version.name,
        cover: 'https://raw.githubusercontent.com/joostory/holybible/master/dist/images/holybible.png',
        css: CSS,
    
        customOpfTemplatePath: path.join(TEMPLATE_DIR, "content.opf.ejs"),
        customNcxTocTemplatePath: path.join(TEMPLATE_DIR, "toc.ncx.ejs"),
        customHtmlTocTemplatePath: path.join(TEMPLATE_DIR, "toc.xhtml.ejs"),
    
        content: content,
        output: path.join(DIST_DIR, `oh-my-bible-${version.vcode}.epub`),
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
