const got = require('got');
const jsdom = require("jsdom");
const jp = require("fs-jetpack");
const jetpack = jp.cwd("out");
const { JSDOM } = jsdom;


//const counties = ['bacs-kiskun', 'baranya', 'bekes', 'borsod-abauj-zemplen', 'csongrad-csanad', 'fejer', 'gyor-moson-sopron', 'hajdu-bihar', 'heves', 'jasz-nagykun-szolnok', 'komarom-esztergom', 'nograd', 'pest', 'somogy', 'szabolcs-szatmar-bereg', 'tolna', 'vas', 'veszprem', 'zala'];
const types = ['lakas', 'haz'];
const counties = ['bacs-kiskun', 'bekes', 'zala'];
const settings = { delayMin: 200, delayMax: 1000 };

run();

async function run() {

    let ds = [];
    const startTime = new Date();

    console.log('started ' + startTime);

    for (let type of types) {
        for (let county of counties) {
            let pages;
            for (let page = 1; !pages || page <= pages; page++) {
                const url = 'https://ingatlan.com/szukites/elado+' + type + '+' + county + '-megye?page=' + page;
                console.log(url);

                await got(url).then(response => {
                    const dom = new JSDOM(response.body);
                    const document = dom.window.document;

                    if (!pages) {
                        pages = parseInt(document.querySelector('.pagination__page-number').textContent.trim().replace('1 / ', '').replace(' oldal', ''));
                        pages = 2;
                        console.log(pages + ' pages...');
                    }

                    document.querySelectorAll('.listing__card').forEach(item => {

                        let externalId = item.parentElement.dataset.id;

                        let hrefRel = item.querySelector('.listing__link').href;
                        let href = 'https://ingatlan.com' + hrefRel;

                        let cityByHref = hrefRel.split('/')[1];

                        let imgSrc = tryGetImgSrc(item);

                        let priceRaw = item.querySelector('.price').textContent.trim();
                        let priceSQMRaw = item.querySelector('.price--sqm').textContent.trim();
                        let address = item.querySelector('.listing__address').textContent.trim();

                        let areaSizeRaw = tryGetParameter(item, 'area-size');
                        let roomCountRaw = tryGetParameter(item, 'room-count');
                        let balconySizeRaw = tryGetParameter(item, 'balcony-size');

                        let price = parseFloat(priceRaw.replace(' M Ft', ''));
                        let priceSQM = parseFloat(priceSQMRaw.replace(' Ft/m2', '').replace(/\s/g, ''));

                        /*let district = 0;
                        if (county == 'pest') {
                            for (let d = 1; d <= 23; d++) {
                                if (address.includes(romanize(d) + '. kerület ')) {
                                    district = d;
                                    break;
                                }
                            }
                        }*/

                        ds.push({
                            externalId: externalId,
                            type: type,
                            county: county,
                            priceRaw: priceRaw,
                            price: price,
                            priceSQMRaw: priceSQMRaw,
                            priceSQM: priceSQM,
                            areaSizeRaw: areaSizeRaw,
                            roomCountRaw: roomCountRaw,
                            balconySizeRaw: balconySizeRaw,
                            address: address,
                            href: href,
                            imgSrc: imgSrc,
                            cityByHref: cityByHref
                        });
                    });
                });
                let delay = getRandomInt(settings.delayMin, settings.delayMax);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    let endTime = new Date();
    console.log('done ' + endTime);
    console.log(ds.length + ' items');
    jetpack.write('ingatlan' + endTime.toJSON().slice(0, 10) + '.json', ds);


    let insertScript = "INSERT INTO REALESTATES (" + mapItemKeys(ds[0]) + ")\nVALUES";
    for (let item of ds) {
        insertScript += "\n\t(" + mapItemValues(item) + "),";
    }
    insertScript = insertScript.slice(0, -1) + ';';

    jetpack.write('insert_script_' + endTime.toJSON().slice(0, 10) + '.sql', insertScript);
}

function mapItemKeys(item) {
    return Object.keys(item).map(function (k) { return k }).join(",");
}

function mapItemValues(item) {
    return Object.keys(item).map(function (k) { return "'" + item[k] + "'" }).join(",");
}

function tryGetParameter(item, name) {
    let element = item.querySelector('.listing__parameter.listing__data--' + name);
    return element ? element.textContent.trim() : '';
}

function tryGetImgSrc(item) {
    let element = item.querySelector('.listing__image');
    return element ? element.src : '';
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function romanize(num) {
    if (isNaN(num))
        return NaN;
    var digits = String(+num).split(""),
        key = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM",
            "", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC",
            "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"],
        roman = "",
        i = 3;
    while (i--)
        roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("M") + roman;
}