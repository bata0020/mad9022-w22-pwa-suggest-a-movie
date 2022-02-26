
const APP = {
    DB: null,
    SW: null,
    isOnline: 'onLine' in navigator && navigator.onLine,
    baseURL: 'https://api.themoviedb.org/3/',
    baseImgURL: 'https://image.tmdb.org/t/p/',
    apiKey: 'aa35c0e1a509278f9804efb52b014afa',
    keyword: '',
    title: '',
    results: [],
    init: () => {
        APP.openDB(APP.registerSW);
    },
    openDB: (next) => {
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
            next = APP.registerSW();
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
        window.addEventListener('online', APP.onlineStatus);
        window.addEventListener('offline', APP.onlineStatus);
        navigator.serviceWorker.addEventListener('message', APP.gotMsg);
        document.getElementById('searchForm').addEventListener('submit', APP.searchSubmitted);
        document.querySelector('.header').addEventListener('click', () => {
            window.location = './index.html';
        });
        let cards = document.querySelector('.cards');
        if (cards) {
            cards.addEventListener('click', APP.getMovieId);
        };
    },
    onlineStatus: (ev) => {
        APP.isOnline = ev.type === 'online' ? true : false;
        APP.SW.postMessage({ ONLINE: APP.isOnline });
    },
    gotMsg: (ev) => {
        console.log(ev);
    },
    searchSubmitted: (ev) => {
        ev.preventDefault();
        let input = document.getElementById('search').value.trim();
        if (!input) return;
        APP.checkSearchStore(input);
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
    checkSearchStore: (keyword) => {
        let tx = APP.createTx('searchStore');
        let store = tx.objectStore('searchStore');
        let check = store.get(keyword);
        check.addEventListener('success', (ev) => {
            let checkResult = ev.target.result;
            if (checkResult === undefined) {
                console.log(`Check success. ${keyword} is not found in searchStore`);
                APP.fetchMovieDB(keyword);
            } else {
                console.log(`${keyword} exists in searchStore`);
                APP.navigate(keyword);
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
            if (storeName === 'searchStore') {
                APP.checkSearchStore(APP.keyword);
            } else {
                APP.checkSuggestStore(keyValue.movieId);
            }
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
            keyword = params.get('keyword');
            //APP.keyword = keyword;
            APP.getSavedResult('searchStore', keyword);
            console.log(`Keyword is: ${APP.keyword}`);
        };
        if(document.body.id === 'suggest') {
            console.log('Now in suggest page');
            let url = window.location.search;
            let movieId = url.split('=')[1].split('&').shift();
            let title = url.split('=').pop().replaceAll('%27',`'`).replaceAll('%20', ' ');
            APP.title = title; // do i need this?
            console.log(movieId);
            console.log(title);
            APP.getSavedResult('suggestStore', movieId);
            console.log(`Title is: ${APP.title}`);
        };
    },
    getSavedResult: (storeName, key) => {
        let tx = APP.createTx(storeName);
        let store = tx.objectStore(storeName);
        let getRequest = store.get(key);
        getRequest.addEventListener('success', (ev) => {
            APP.results = ev.target.result.value;
            APP.keyword = key;
            console.log(`searchStore has results for keyword: ${key}`);
            console.log(`suggestStore has results for id: ${key} and title: ${APP.title}`);
            console.log(APP.results);
            // if (parseInt(key) === 'NaN') {
            //     APP.keyword = key;
            //     console.log(APP.keyword)
            // } else {
            //     APP.keyword = APP.title;
            //     console.log(APP.keyword)
            // }
            APP.displayCards(APP.keyword, APP.title);
        });
        getRequest.addEventListener('error', (err) => {
            console.warn(err);
        });
    },
    displayCards: (keyOrId, title) => {
        console.log(`Keyword/movie id value: ${keyOrId}`);
        console.log(`Title value: ${title}`);
        console.log(`Results length: ${APP.results.length}`);
        let h2 = document.querySelector('.h2');
        if (!title) {
            h2.innerHTML = `Search results for <span class="keyword">"${keyOrId}"</span>`;
        } else {
            h2.innerHTML = `Suggested results for <span class="keyword">"${title}"</span>`;
        };
        if (APP.results.length === 0) {
            h2.innerHTML = `No results for <span class="keyword">"${keyOrId}"</span>`;
        };
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
            item.poster_path === null ? img.src = './img/default.jpg' : img.src = ''.concat(APP.baseImgURL, 'w500', item.poster_path);
            img.alt = item.original_title;
            title.textContent = `Title: ${item.original_title}`;
            title.classList.add('title');
            title.setAttribute('data-movieId', item.id)
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
    getMovieId: (ev) => {
        let clicked = ev.target.closest('.card');
        let movieId = clicked.children[1].dataset.movieid;
        let title = clicked.children[1].textContent;
        APP.title = title.slice(7, title.length);
        console.log(movieId, APP.title);
        APP.checkSuggestStore(movieId);
    },
    checkSuggestStore: (id) => {
        let tx = APP.createTx('suggestStore');
        let store = tx.objectStore('suggestStore');
        let checkId = store.get(id);
        checkId.addEventListener('success', (ev) => {
            let checkResult = ev.target.result;
            if (checkResult === undefined) {
                console.log(`${id} is not found in suggestStore`);
                APP.fetchSuggestedMovies(id);
            } else {
                console.log(`${id} exists in suggestStore`);
                APP.navigate(APP.title, id);
            };
        });
        checkId.addEventListener('error', (err) => {
            console.warn(err);
        });
    },
    fetchSuggestedMovies: (id) => {
        let url = ''.concat(APP.baseURL, `/movie/${id}/similar?api_key=`, APP.apiKey);
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
            let movieId = id;
            let title = APP.title;
            let keyValue = { movieId, title, value }
            console.log(keyValue);
            APP.saveToDB(keyValue, 'suggestStore');
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