const fetch = require('node-fetch');
const mongo = require('mongodb').MongoClient;
const schedule = require('node-schedule');
const moment = require('moment');

const slackUrl = process.env.MMA_SLACK_URL;

async function initDB() {
    const host = process.env.MONGO_URL || 'mongodb://host.docker.internal:27017';

    const client = await mongo.connect(host, { useNewUrlParser: true });
    const dbName = 'work_mma_alarm';
    const db = client.db(dbName);

    return {
        db,
        closeDb: () => client.close()
    }
}


async function main() {
    try {
        const { db, closeDb } = await initDB();
        const collection = db.collection('newDocumentCounts');
        const count = await getCurrentNewDocumentCount();
        console.log('\t\t * Current New Document Count: ', count);
        const isNew = await isNewDocumentCountChanged(collection, count);
        await insertNewDocument(collection, count);

        if (isNew) {
            await onChanged()
        }
        closeDb();
    } catch (e) {
        onError(e)
    }
}

async function getCurrentNewDocumentCount() {
    const url = 'https://work.mma.go.kr/caisBYIS/board/boardList.do?menu_id=m_m8_6&tmpl_id=1&gesipan_gbcd=13';
    const options = {
        credentials: 'include',
        headers: {
            accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
            'accept-language': 'en,vi;q=0.9,en-US;q=0.8',
            'cache-control': 'max-age=0',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
        },
        referrer: 'https://work.mma.go.kr/caisBYIS/main.do',
        referrerPolicy: 'no-referrer-when-downgrade',
        body: null,
        method: 'GET',
        mode: 'cors',
    };

    const res = await fetch(url, options);
    const htmlStr = await res.text()

    return (htmlStr.match(/새글/g) || []).length;
}

async function isNewDocumentCountChanged(collection, count) {
    const last = await collection.find({}).sort({ created_at: -1 }).limit(1).toArray();
    if (!last[0]) return true
    console.log("\t\t * Last New Document Count: ", last[0].count, "\n\n");
    return last[0].count < count;
}

async function insertNewDocument(collection, count) {
    return collection.insertOne({ count, created_at: new Date() });
}

async function onChanged() {
	const url = slackUrl;
	const options = {
      headers: {
          "Content-Type": "application/json"
      },
      method: "POST",
		body: JSON.stringify({
			text: "[병역일터] 새로운 공지사항이 있습니다.\nhttps://work.mma.go.kr/caisBYIS/board/boardList.do?menu_id=m_m8_6&tmpl_id=1&gesipan_gbcd=13"
		}),
	};

	return await fetch(url, options);
}

function onError(e) {
    console.error(e, new Date());
}

if (slackUrl) {
    schedule.scheduleJob("0 30 */1 * * *", () => {
        console.log(`\n\n\t\t * Triggered ${moment().utcOffset(9).toISOString(true)}\n`);
        main()
    });
    console.log(" * Schedule Job Registered. Slack Url: " + slackUrl);
} else {
    console.log("Slack Url is not defined!")
}

module.exports = main;
