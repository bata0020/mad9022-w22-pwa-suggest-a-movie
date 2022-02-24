
const APP = {
    DB: null,
    baseURL: 'https://api.themoviedb.org/3/',
    baseImgURL: 'https://image.tmdb.org/t/p/',
    apiKey: 'aa35c0e1a509278f9804efb52b014afa',
    keyword: '',
    results: [],
    init: () => {
        APP.openDB();
        APP.addListeners();
    },
    openDB: () => {
        let openDBreq = indexedDB.open('movieDB', 3);
        openDBreq.addEventListener('upgradeneeded', (ev) => {
            APP.DB = ev.target.result;
            try {
                APP.DB.deleteObjectStore('searchStore');
                APP.DB.deleteObjectStore('suggestStore');
            } catch (err) {
                console.log('Error on deleting old versions.')
            };
            let searchStore = APP.DB.createObjectStore('searchStore', {
                keyPath: 'keyword',
                autoIncrement: false
            });
            let suggestStore = APP.DB.createObjectStore('suggestStore', {
                keyPath: 'movieId',
                autoIncrement: false
            });
        });
        openDBreq.addEventListener('success', (ev) => {
            APP.DB = ev.target.result;
            // register SW later
        });
        openDBreq.addEventListener('error', (err) => {
            console.warn(err);
        });
    },
    // createTx: (storeName) => {
    //     let tx = APP.DB.transaction(storeName, 'readwrite');
    //     tx.addEventListener('error', (err) => {
    //         console.warn(err);
    //     });
    //     tx.addEventListener('success', (ev) => {
    //         console.log(ev.target.result);
    //     });
    //     tx.addEventListener('complete', (ev) => {
    //         console.log(ev.target.result);
    //     });
    //     return tx;
    // },
    addListeners: () => {
        document.getElementById('searchForm').addEventListener('submit', APP.searchSubmitted);
    },
    searchSubmitted: (ev) => {
        ev.preventDefault();
        let input = document.getElementById('search').value.trim();
        if (!input) return;
        APP.checkDB(input);
    },
    checkDB: (keyword) => {
        // checks indexeddb for match keyword
        let tx = APP.DB.transaction('searchStore');
        tx.addEventListener('complete', (ev) => {
            console.log(ev.target.result);
            console.log('Tx Complete. Do a fetch');
            // what is next step?
            APP.fetchMovieDB(keyword);
        });
        let store = tx.objectStore('searchStore');
        let check = store.get(keyword);
        check.addEventListener('success', (ev) => {
            let checkResult = ev.target.result;
            if (checkResult === undefined) {
                console.log(`Check success. ${keyword} is not found in searchStore`);
                // if does not exists do a fetch from api
            } else {
                console.log(`${keyword} exists in searchStore`);
            }
        },
        { once: true }
        );
        check.addEventListener('error', (err) => {
            console.warn(err);
        });
        check.addEventListener('complete', (ev) => {
            console.log(`${keyword} exists in searchStore`);
            console.log(ev.target.results);
        });
    },
    fetchMovieDB: (endpoint) => {
        let url = ''.concat(APP.baseURL, 'search/movie?api_key=', APP.apiKey, '&query=', endpoint);
        fetch (url, {
            method: 'GET'
        })
        .then (response => {
            if (response.status >= 400) {
                throw new NetworkError(`Failed to fetch to ${url}`, response.status, response.statusText);
            }
            return response.json()
        })
        .then (data => {
            console.log(data.results);
            let value = data.results;
            let keyword = endpoint;
            let obj = { keyword, value }
            console.log(obj);
            APP.saveToDB(obj, 'searchStore');
        })
        .catch (err => {
            console.warn(err);
        });
    },
}

document.addEventListener('DOMContentLoaded', APP.init);

class NetworkError extends Error {
    constructor(msg, status, statusText){
        super(msg);
        this.status = status;
        this.statusText = statusText;
    }
}