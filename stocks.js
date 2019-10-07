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

function getIndicators(company) {
    return new Promise((resolve, reject) => {
        if (!conf.atSignals) {
            resolve(company);
        }
        let id = company.id;
        request.get({
            url: `https://www.biznesradar.pl/get-indicators-json/?oid=${id}&aggregate=1d`,
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            }
        },
            (error, res, body) => {
                if (error) reject(error)
                if (res.statusCode != 200) {
                    reject('Invalid status code <' + res.statusCode + '>');
                }

                company.indicators = JSON.parse(body).data
                resolve(company);
            });
    });
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

async function update() {
    const nodes = await Promise.all(conf.stocks.map(elem => getMeta(elem).then(getIndicators).then(createHtml)));
    render(nodes.sort(compareNode));

    conf.lastCheck = moment().unix();
    if (conf.notifications) {
        let length = conf.stocks.length;
        let time = moment.unix(conf.lastCheck).format('HH:mm:ss');
        new Notification("Stocks Watcher Updated", {
            title: "Stocks Watcher Updated",
            body: `${length} Stocks Has Been Updated at ${time}`,
            silent: true
        });
    }
}

function render(stocks) {
    let node = document.getElementById("stocks");
    while (node.hasChildNodes()) {
        node.removeChild(node.firstChild);
    }
    stocks.forEach((s) => node.appendChild(s.node));
}

function createHtml(company) {
    return new Promise((resolve, reject) => {
        let node = document.createElement("div");
        node.className = "stock";
        node.id = company.id;

        node.appendChild(renderHeader(company));
        node.appendChild(renderLastTransaction(company));
        let volNode = renderVolumen(company);
        if (volNode) {
            node.appendChild(renderVolumen(company));
        }
        if (conf.atSignals) {
            node.appendChild(renderIndicators(company));
            node.appendChild(renderFinalIndicator(company));
        }

        resolve({ company: company, node: node });
    });
}

function renderHeader(company) {
    let node = document.createElement("div");
    node.className = "header";
    let link = document.createElement("span");
    link.innerHTML = company.meta.displayName;
    link.onclick = function (e) {
        e.preventDefault();
        shell.openExternal("https://www.biznesradar.pl/notowania/" + company.meta.ut);
    };
    node.appendChild(link);
    node.appendChild(renderPrice(company));

    return node
}

function renderPrice(company) {
    currentPrice = company.meta.c;
    previousPrice = company.meta.pc;

    change = ((currentPrice - previousPrice) / previousPrice * 100);

    let wrapChange = document.createElement("span");
    let wrap = document.createElement("span");
    let newElText = "";
    if (change > 0) {
        newElText = " ▲ ";
        wrap.className = "up";
        wrapChange.className = "up";
    } else if (change === 0) {
        newElText = " ▬ ";
        wrap.className = "no-change";
        wrapChange.className = "no-change";
    } else {
        newElText = " ▼ ";
        wrap.className = "down";
        wrapChange.className = "down";
    }
    wrapChange.className += " padding-right02";
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

    let node = document.createElement("span");
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
    let vol = company.meta.mc
    let volFmt = currencyFormat(vol);
    if (volFmt === "") {
        return null;
    }

    let node = document.createElement("div");
    node.className = "volumen";
    let label = document.createElement("span");
    label.innerHTML = "volumen: ";
    label.className = "key";
    let value = document.createElement("span");
    value.innerHTML = volFmt;
    value.className = "value";

    node.appendChild(label);
    node.appendChild(value);

    return node;
}

function renderIndicators(company) {
    let node = document.createElement("div");
    node.className = "signals";

    let label = document.createElement("span");
    label.innerHTML = 'signals: ';

    node.appendChild(label);
    renderIndicator(node, company.indicators.averages.SMA15);
    renderIndicator(node, company.indicators.indicators.RSI);
    renderIndicator(node, company.indicators.indicators.STS);
    renderIndicator(node, company.indicators.indicators.MACD);

    return node;
}

function renderIndicator(parent, indicator) {
    let label = document.createElement("span");
    label.innerHTML = indicator.name + ": ";
    label.className = "signal";

    let value = document.createElement("span");
    value.innerHTML = indicator.value;
    value.classList.add(getClass(indicator.action_value), "padding-right");

    parent.appendChild(label);
    parent.appendChild(value);
}

function renderFinalIndicator(company) {
    let node = document.createElement("div");
    node.className = "summary";

    let label = document.createElement("span");
    label.innerHTML = 'summary: ';

    let value = document.createElement("span");
    value.innerHTML = company.indicators.summary.summary.action_name;
    value.className = getClass(company.indicators.summary.summary.action_value);

    let valueDesc = document.createElement("span");

    let buy = document.createElement("span");
    buy.innerHTML = company.indicators.summary.summary.buy;
    buy.className = "up";

    let sell = document.createElement("span");
    sell.innerHTML = company.indicators.summary.summary.sell;
    sell.className = "down";

    let neutral = document.createElement("span");
    neutral.innerHTML = company.indicators.summary.summary.neutral;
    neutral.className = "no-change";

    let slash = document.createElement("span");
    slash.innerHTML = " / ";
    let slash2 = document.createElement("span");
    slash2.innerHTML = " / ";

    let left = document.createElement("span");
    left.innerHTML = "  ( ";

    let right = document.createElement("span");
    right.innerHTML = " )";

    valueDesc.appendChild(left);
    valueDesc.appendChild(buy);
    valueDesc.appendChild(slash);
    valueDesc.appendChild(neutral);
    valueDesc.appendChild(slash2);
    valueDesc.appendChild(sell);
    valueDesc.appendChild(right);

    node.appendChild(label);
    node.appendChild(value);
    node.appendChild(valueDesc);

    return node;
}

function getClass(val) {
    switch (val) {
        case 2:
        case 1:
            return 'up';
        case 0:
            return 'no-change';
        case -1:
        case -2:
            return 'down';
        default:
            return 'no-change';
    }
}

function currencyFormat(num) {
    if (num) {
        return num.toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    return "";
}

function compareNode(a, b) {
    if (a.company.index && !b.company.index)
        return -1;
    if (a.company.index && b.company.index)
        return a.company.name.localeCompare(b.company.name);
    if (b.company.index && !a.company.index)
        return 1;

    return a.company.name.localeCompare(b.company.name);
}

function start() {
    let home = process.env.HOME;
    let init = function (configuration) {
        conf = configuration;

        // start info refresher
        setInterval(setInfo, 1000); // 1s

        // start first updating manually 
        update();

        // start updater each
        setInterval(update, conf.refreshInterval * 1000);
    }

    fs.readFile(`${home}/.stocks.json`, (err, data) => {
        if (err) {
            console.log("no .stocks.json file in HOME directory, using default stocks file");
            fs.readFile(`stocks.json`, (err, data) => {
                if (err) {
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