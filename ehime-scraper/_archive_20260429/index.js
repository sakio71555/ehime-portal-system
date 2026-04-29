const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeEhime() {
  console.log('通信を開始します...');

  try {
    // ターゲットURL（愛媛県庁のトップページ）
    const url = 'https://www.pref.ehime.jp/';
    
    // 1. axiosでページのHTMLデータを取得
    const response = await axios.get(url);
    const html = response.data;

    // 2. cheerioでHTMLを解析できる状態にする
    const $ = cheerio.load(html);

    // 3. 欲しい情報を抜き出す
    // 例：ページのタイトルタグを取得
    const pageTitle = $('title').text();
    console.log('\n=== 取得結果 ===');
    console.log('ページタイトル:', pageTitle);

    // 例：ページ内のすべてのリンク（aタグ）の数を数える
    const linkCount = $('a').length;
    console.log('ページ内のリンク数:', linkCount, '個');
    console.log('================\n');

    console.log('スクレイピング成功です！');

  } catch (error) {
    console.error('エラーが発生しました:', error.message);
  }
}

// 実行
scrapeEhime();