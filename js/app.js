
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
        APP.displayOffline();
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
        document.getElementById('searchForm').addEventListener('submit', APP.searchSubmitted);
        document.querySelector('.header').addEventListener('click', () => {
            window.location = './index.html';
        });
        let cards = document.querySelector('.cards');
        if (cards) { cards.addEventListener('click', APP.getMovieId) };
        let list = document.querySelector('.list');
        if (list) { list.addEventListener('click', APP.getClicked) };
    },
    onlineStatus: (ev) => {
        APP.isOnline = ev.type === 'online' ? true : false;
        APP.SW.postMessage({ ONLINE: APP.isOnline });
        APP.displayOffline();
    },
    displayOffline: () => {
        let display = document.getElementById('offline');
        if (!APP.isOnline) return display.classList.add('offline');
        return display.classList.remove('offline');
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
                console.log(`Checked searchStore. ${keyword} is not found.`);
                APP.fetchMovieDB(keyword);
            } else {
                console.log(`Checked searchStore. ${keyword} exists.`);
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
            if (response.status > 399) {
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
            APP.keyword = endpoint;
            if (data.results.length === 0) return APP.displayCards(keyword);
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
        if (!id) return window.location = `./results.html?keyword=${keyword}`;
        return window.location = `./suggest.html?id=${id}&title=${keyword}`;
    },
    pageSpecific: () => {
        if(document.body.id === 'home') {
            console.log('Now in Home Page');
            let dataList = document.querySelector('.list');
            let tx = APP.createTx('searchStore');
            let store = tx.objectStore('searchStore');
            let getAll = store.getAll();
            getAll.addEventListener('success', (ev) => {
                let results = ev.target.result;
                let listContent = results.map((item) => {
                    let li = document.createElement('li');
                    li.append(item.keyword);
                    return li;
                });
                dataList.append(...listContent);
            });
        };
        if(document.body.id === 'results') {
            console.log('Now in results page');
            let url = new URL(window.location.href);
            let params = url.searchParams;
            keyword = params.get('keyword');
            APP.getSavedResult('searchStore', keyword);
            document.title = `Searched for ${keyword}`;
        };
        if(document.body.id === 'suggest') {
            console.log('Now in suggest page');
            let url = window.location.search;
            let movieId = url.split('=')[1].split('&').shift();
            let title = url.split('=').pop().replaceAll('%27',`'`).replaceAll('%20', ' ');
            APP.title = title;
            APP.getSavedResult('suggestStore', movieId);
            document.title = `Suggested results for ${title}`;
        };
        if(document.body.id === 'fourohfour') {
            console.log('Oh no! You got a 404!');
            let dataList = document.querySelector('.list');
            let tx = APP.createTx('searchStore');
            let store = tx.objectStore('searchStore');
            let getAll = store.getAll();
            getAll.addEventListener('success', (ev) => {
                let results = ev.target.result;
                let listContent = results.map((item) => {
                    let li = document.createElement('li');
                    li.append(item.keyword);
                    return li;
                });
                dataList.append(...listContent);
            });
        }
    },
    getSavedResult: (storeName, key) => {
        let tx = APP.createTx(storeName);
        let store = tx.objectStore(storeName);
        let getRequest = store.get(key);
        getRequest.addEventListener('success', (ev) => {
            APP.results = ev.target.result.value;
            APP.keyword = key;
            if (!APP.title) {
                console.log(`searchStore has results for keyword: ${key}`);
            } else {
                console.log(`suggestStore has results for id: ${key} and title: ${APP.title}`);
            };
            console.log(APP.results);
            APP.displayCards(APP.keyword, APP.title);
        });
        getRequest.addEventListener('error', (err) => {
            console.warn(err);
        });
    },
    displayCards: (keyOrId, title) => {
        let h2 = document.querySelector('.h2');
        if (APP.results.length === 0) return h2.innerHTML = `No matching results for <span class="keyword">"${keyOrId}"</span>`;
        if (!title) {
            h2.innerHTML = `Search results for <span class="keyword">"${keyOrId}"</span>`;
        } else {
            h2.innerHTML = `Suggested results for <span class="keyword">"${title}"</span>`;
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
        APP.checkSuggestStore(movieId);
    },
    checkSuggestStore: (id) => {
        let tx = APP.createTx('suggestStore');
        let store = tx.objectStore('suggestStore');
        let checkId = store.get(id);
        checkId.addEventListener('success', (ev) => {
            let checkResult = ev.target.result;
            if (checkResult === undefined) {
                console.log(`Checked suggestStore. ${id} is not found.`);
                APP.fetchSuggestedMovies(id);
            } else {
                console.log(`Checked suggestStore. ${id} exists.`);
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
            APP.saveToDB(keyValue, 'suggestStore');
        })
        .catch (err => {
            console.warn(err);
        });
    },
    getClicked: (ev) => {
        let clicked = ev.target.closest('li');
        APP.checkSearchStore(clicked.textContent);
    }
}

document.addEventListener('DOMContentLoaded', APP.init);

class NetworkError extends Error {
    constructor(msg, status, statusText){
        super(msg);
        this.status = status;
        this.statusText = statusText;
    }
}