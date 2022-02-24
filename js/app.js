
const APP = {
    DB: null,
    SW: null,
    isONLINE: 'onLine' in navigator && navigator.onLine,
    baseURL: 'https://api.themoviedb.org/3/',
    baseImgURL: 'https://image.tmdb.org/t/p/',
    apiKey: 'aa35c0e1a509278f9804efb52b014afa',
    keyword: '',
    results: [],
    init: () => {
        APP.openDB();
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
            APP.registerSW();
        });
        openDBreq.addEventListener('error', (err) => {
            console.warn(err);
        });
    },
    registerSW: () => {
        navigator.serviceWorker.register('/sw.js').catch(function (err) {
            console.warn(err);
        });
        navigator.serviceWorker.ready.then((registration) => {
            APP.SW = registration.active;
        });
        APP.addListeners();
        APP.pageSpecific();
    },
    addListeners: () => {
        document.getElementById('searchForm').addEventListener('submit', APP.searchSubmitted);
        document.querySelector('.header').addEventListener('click', () => {
            window.location = './index.html';
        });
    },
    searchSubmitted: (ev) => {
        ev.preventDefault();
        let input = document.getElementById('search').value.trim();
        if (!input) return;
        APP.checkDBforMatch(input);
    },
    createTx: (storeName) => {
        let tx = APP.DB.transaction(storeName, 'readwrite');
        tx.addEventListener('complete', (ev) => {
            console.log('Tx complete.')
        });
        tx.addEventListener('error', (err) => {
            console.warn(err);
        });
        return tx;
    },
    checkDBforMatch: (keyword) => {
        let tx = APP.createTx('searchStore');
        let store = tx.objectStore('searchStore');
        let check = store.get(keyword);
        check.addEventListener('success', (ev) => {
            let checkResult = ev.target.result;
            if (checkResult === undefined) {
                console.log(`Check success. ${keyword} is not found in searchStore`);
                APP.fetchMovieDB(keyword);
                // if does not exists do a fetch from api
            } else {
                console.log(`${keyword} exists in searchStore`);
                // APP.results = ev.target.result;
                // console.log(APP.results);
                APP.navigate(keyword);
                //APP.getSavedResult('searchStore', keyword);
            };
        });
        check.addEventListener('error', (err) => {
            console.warn(err);
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
            let value = data.results.map(item => {
                let {id, original_title, overview, poster_path, release_date, popularity, vote_average} = item;
                return {id, original_title, overview, poster_path, release_date, popularity, vote_average};
            });
            let keyword = endpoint;
            let keyValue = { keyword, value }
            console.log(keyValue);
            APP.keyword = endpoint;
            APP.saveToDB(keyValue, 'searchStore');
        })
        .catch (err => {
            console.warn(err);
        });
    },
    saveToDB: (keyValue, storeName) => {
        let tx = APP.createTx(storeName, 'readwrite');
        let store = tx.objectStore(storeName);
        let saveRequest = store.add(keyValue);
        saveRequest.addEventListener('success', (ev) => {
            console.log('Save success');
            APP.checkDB(APP.keyword);
        });
        saveRequest.addEventListener('error', (err) => {
            console.warn(err);
        });
    },
    navigate: (keyword, id) => {
        if (!id) {
            window.location = `./results.html?keyword=${keyword}`;
        } else {
            window.location = `./suggest.html?id=${id}&title=${keyword}`;
        }
    },
    pageSpecific: () => {
        if(document.body.id === 'home') {
            console.log('You are in Home Page');
        };
        if(document.body.id === 'results') {
            console.log('Now in results page');
            let url = new URL(window.location.href);
            let params = url.searchParams;
            console.log(params.has('keyword'), params.get('keyword'));
            keyword = params.get('keyword');
            APP.getSavedResult('searchStore', keyword);
        };
        if(document.body.id === 'suggest') {
            console.log('Now in suggest page');
        };
    },
    getSavedResult: (storeName, key) => {
        let tx = APP.createTx(storeName);
        let store = tx.objectStore(storeName);
        let getRequest = store.get(key);
        getRequest.addEventListener('success', (ev) => {
            APP.results = ev.target.result.value;
            APP.keyword = key;
            console.log(APP.results);
            APP.displayCards();
        });
        getRequest.addEventListener('error', (err) => {
            console.warn(err);
        });
    },
    displayCards: () => {
        let h2 = document.querySelector('.h2');
        h2.innerHTML = `Search results for <span class="keyword">"${APP.keyword}"</span>`;
        let ul = document.querySelector('.cards');
        ul.innerHTML = '';
        let ulContent = APP.results.map((item) => {
            let li = document.createElement('li');
            let div = document.createElement('div');
            let img = document.createElement('img');
            let title = document.createElement('p');
            let releaseDate = document.createElement('p');
            let vote = document.createElement('p');
            li.classList.add('flex');
            div.classList.add('card');
            img.src = ''.concat(APP.baseImgURL, 'w780', item.poster_path);
            img.alt = item.original_title;
            title.textContent = `Title: ${item.original_title}`;
            title.setAttribute('data-movieId', item.id);
            title.classList.add('title');
            releaseDate.textContent = `Release Date: ${item.release_date}`;
            vote.textContent = `Average Vote: ${item.vote_average}`;
            vote.classList.add('vote');
            div.append(img);
            div.append(title);
            div.append(releaseDate);
            div.append(vote);
            li.append(div)
            return li;
        });
        ul.append(...ulContent);
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