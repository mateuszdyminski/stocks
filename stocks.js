const request = require('request');
const moment = require('moment');
const { shell } = require('electron');
const fs = require('fs');

let conf = {};

function setInfo() {
    let clock = document.getElementById("clock_value");
    clock.innerHTML = moment().format('HH:mm:ss');

    let counter = document.getElementById("counter_value");
    counter.innerHTML = conf.stocks.length;
    
    let last = document.getElementById("last_refresh_value");
    last.innerHTML = moment.unix(conf.lastCheck).format('HH:mm:ss');

    let interval = document.getElementById("refresh_interval");
    interval.innerHTML = conf.refreshInterval + "s";
}

function getMeta(company) {
    return new Promise((resolve, reject) => {
        let id = company.id;
        request.post('https://www.biznesradar.pl/get-quotes-json/', {
        // request.post('http://localhost:8080/stocks', {
            body: `oid=${id}&range=1d`,
            json: false,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            }
        }, (error, res, body) => {
            if (error) reject(error)
            if (res.statusCode != 200) {
                reject('Invalid status code <' + res.statusCode + '>');
            }
            
            company.meta = JSON.parse(body).data[0].symbol
            resolve(company);
        })
    });
}

function update() {
    conf.stocks.forEach(elem => getMeta(elem).then(renderMeta));
    conf.lastCheck = moment().unix();
}

function renderMeta(company) {
    let node = document.getElementById(company.id)
    let newStock = false;
    if (node) {
        while (node.hasChildNodes()) {
            node.removeChild(node.firstChild);
         }
    } else {
        newStock = true;
        node = document.createElement("div");
        node.className = "stock";
        node.id = company.id;    
    }
    
    node.appendChild(renderHeader(company));
    node.appendChild(renderPrice(company));
    node.appendChild(renderLastTransaction(company));
    node.appendChild(renderVolumen(company));

    if (newStock) {
        let elems = document.getElementsByClassName("stocks");
        elems[0].appendChild(node);
    }
}

function renderHeader(company) {
    let node = document.createElement("div");
    node.className = "header";
    var link = document.createElement("span");
    link.innerHTML = company.meta.displayName;
    link.onclick = function (e) {
        e.preventDefault();
        shell.openExternal("https://www.biznesradar.pl/notowania/" + company.meta.ut);
    };
    node.appendChild(link);

    return node
}

function renderPrice(company) {
    currentPrice = company.meta.c;
    previousPrice = company.meta.pc;

    change = ((currentPrice - previousPrice) / previousPrice * 100);

    let wrapChange = document.createElement("span");
    let wrap = document.createElement("span");
    var newElText = "";
    if (change > 0) {
        newElText = "▲ ";
        wrap.className = "up";
        wrapChange.className = "up";
    } else if (change === 0) {
        newElText = "▬ ";
        wrap.className = "no-change";
        wrapChange.className = "no-change";
    } else {
        newElText = "▼ ";
        wrap.className = "down";
        wrapChange.className = "down";
    }
    let textNode = document.createTextNode(newElText);
    wrap.appendChild(textNode);

    let indicatorEl = document.createElement("span");
    indicatorEl.appendChild(wrap);

    let changeEl = document.createElement("span");
    
    changeEl.appendChild(wrapChange);
    changeEl.className = "change-indicator";
    wrapChange.innerHTML = change.toFixed(2) + "%";

    let priceEl = document.createElement("span");
    priceEl.innerHTML = currencyFormat(currentPrice);

    let node = document.createElement("div");
    node.className = "price"
    node.appendChild(priceEl);
    node.appendChild(indicatorEl);
    node.appendChild(wrapChange);

    return node
}

function renderLastTransaction(company) {
    lastTransaction = company.meta.ts;

    let node = document.createElement("div");
    node.className = "last-transaction";
    let label = document.createElement("span");
    label.innerHTML = "last transaction: "
    label.className = "key";
    let value = document.createElement("span");
    value.innerHTML = moment.unix(lastTransaction).format('HH:mm:ss');
    value.className = "value";
     
    node.appendChild(label);
    node.appendChild(value);

    return node;
}

function renderVolumen(company) {
    vol = company.meta.mc

    let node = document.createElement("div");
    node.className = "volumen";
    let label = document.createElement("span");
    label.innerHTML = "volumen: ";
    label.className = "key";
    let value = document.createElement("span");
    value.innerHTML = currencyFormat(vol);
    value.className = "value";

    node.appendChild(label);
    node.appendChild(value);

    return node;
}

function currencyFormat(num) {
    return num.toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function start() {
    let home = process.env.HOME;
    let init = function(configuration) {
        conf = configuration;

        // start info refresher
        setInterval(setInfo, 1000); // 1s

        // start first updating manually 
        update();
    
        // start updater each
        setInterval(update, conf.refreshInterval * 1000);
    }

    fs.readFile(`${home}/.stocks.json`, (err, data) => {
        if (err)  {
            console.log("no .stocks.json file in HOME directory, using default stocks file");
            fs.readFile(`stocks.json`, (err, data) => {
                if (err)  {
                    console.log("can't read default stocks.json. exiting...");
                    process.exit(1);
                }
                let conf = JSON.parse(data);
                init(conf);
            });
        } else {
            let conf = JSON.parse(data);
            init(conf);
        }
    });
}

start();