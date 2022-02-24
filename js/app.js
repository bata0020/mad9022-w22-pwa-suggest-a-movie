
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
    createTx: (storeName) => {
        let tx = APP.DB.transaction(storeName, 'readwrite');
        tx.addEventListener('error', (err) => {
            console.warn(err);
        })
    },
    addListeners: () => {
        
    },
}

document.addEventListener('DOMContentLoaded', APP.init);