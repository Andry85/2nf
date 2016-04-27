function init() {

     var myPlacemark;

    var myMap = new ymaps.Map('map', {
            center: [48.720348, 27.522239],
            zoom: 12,
            type: 'yandex#map',
            controls: []
        }),
        searchStartPoint = new ymaps.control.SearchControl({
            options: {
                useMapBounds: true,
                noPlacemark: true,
                noPopup: true,
                placeholderContent: 'Адреса початкової точки',
                size: 'large'
            }
        }),
        searchFinishPoint = new ymaps.control.SearchControl({
            options: {
                useMapBounds: true,
                noCentering: true,
                noPopup: true,
                noPlacemark: true,
                placeholderContent: 'Адреса кінцевої точки',
                size: 'large',
                float: 'none',
                position: { left: 10, top: 44 }
            }
        }),
        calculator = new DeliveryCalculator(myMap, myMap.getCenter());

    myMap.controls.add(searchStartPoint);
    myMap.controls.add(searchFinishPoint);

    searchStartPoint.events.add('resultselect', function (e) {
        var results = searchStartPoint.getResultsArray(),
            selected = e.get('index'),
            point = results[selected].geometry.getCoordinates();

        calculator.setStartPoint(point);
    })
        .add('load', function (event) {
            // По полю skip определяем, что это не дозагрузка данных.
            // По getRusultsCount определяем, что есть хотя бы 1 результат.
            if (!event.get('skip') && searchStartPoint.getResultsCount()) {
                searchStartPoint.showResult(0);
            }
        });

    searchFinishPoint.events.add('resultselect', function (e) {
        var results = searchFinishPoint.getResultsArray(),
            selected = e.get('index'),
            point = results[selected].geometry.getCoordinates();

        calculator.setFinishPoint(point);
    })
        .add('load', function (event) {
            // По полю skip определяем, что это не дозагрузка данных.
            // По getRusultsCount определяем, что есть хотя бы 1 результат.
            if (!event.get('skip') && searchFinishPoint.getResultsCount()) {
                searchFinishPoint.showResult(0);
            }
        });


         myPlacemark = new ymaps.Placemark([48.720348, 27.522239], {
                hintContent: 'смт. Муровані Курилівці',
                balloonContent: 'вул. Димитрова, 30'
            });
            
            myMap.geoObjects.add(myPlacemark);
            myMap.behaviors.disable('drag');
            myMap.options.set('scrollZoomSpeed', 0.5);

}

function DeliveryCalculator(map, finish) {
    this._map = map;
    this._start = null;
    this._route = null;
    this._startBalloon;
    this._finishBalloon;

    map.events.add('click', this._onClick, this);
}

var ptp = DeliveryCalculator.prototype;

ptp._onClick= function (e) {
    if (this._start) {
        this.setFinishPoint(e.get('coords'));
    } else {
        this.setStartPoint(e.get('coords'));
    }
};

ptp._onStartDragEnd = function (e) {
    var coords = this._start.geometry.getCoordinates();
    this.geocode("start", coords);
}

ptp._onFinishDragEnd = function (e) {
    var coords = this._finish.geometry.getCoordinates();
    this.geocode("finish", coords);
}

ptp.getDirection = function () {
    if(this._route) {
        this._map.geoObjects.remove(this._route);
    }

    if (this._start && this._finish) {
        var self = this,
            start = this._start.geometry.getCoordinates(),
            finish = this._finish.geometry.getCoordinates(),
            startBalloon = this._startBalloon,
            finishBalloon = this._finishBalloon;


        ymaps.route([start, finish])
            .then(function (router) {
                var distance = Math.round(router.getLength() / 1000),
                    message = '<span>Расстояние: ' + distance + 'км.</span><br/>';

                self._route = router.getPaths();

                self._route.options.set({ strokeWidth: 5, strokeColor: '0000ffff', opacity: 0.5 });
                self._map.geoObjects.add(self._route);
                self._start.properties.set('balloonContentBody', startBalloon + message.replace('%s', self.calculate(distance)));
                self._finish.properties.set('balloonContentBody', finishBalloon + message.replace('%s', self.calculate(distance)));

            });

        self._map.setBounds(self._map.geoObjects.getBounds())
    }
};

ptp.setStartPoint = function (position) {
    if(this._start) {
        this._start.geometry.setCoordinates(position);
    }
    else {
        this._start = new ymaps.Placemark(position, { iconContent: 'А' }, { draggable: true });
        this._start.events.add('dragend', this._onStartDragEnd, this);
        this._map.geoObjects.add(this._start);
    }
    this.geocode("start", position);
};

ptp.setFinishPoint = function (position) {
    if(this._finish) {
        this._finish.geometry.setCoordinates(position);
    }
    else {
        this._finish = new ymaps.Placemark(position, { iconContent: 'Б' }, { draggable: true });
        this._finish.events.add('dragend', this._onFinishDragEnd, this);
        this._map.geoObjects.add(this._finish);
    }
    if (this._start) {
        this.geocode("finish", position);
    }
};

ptp.geocode = function (str, point) {
    ymaps.geocode(point).then(function(geocode) {
        if (str == "start") {
            this._startBalloon = geocode.geoObjects.get(0) &&
                geocode.geoObjects.get(0).properties.get('balloonContentBody') || '';
            console.log(str + " " + this._startBalloon);
        } else {
            this._finishBalloon = geocode.geoObjects.get(0) &&
                geocode.geoObjects.get(0).properties.get('balloonContentBody') || '';
            console.log(str + " " + this._finishBalloon);
        }
        this.getDirection();
    }, this);

}
ptp.calculate = function (len) {
    // Константы.
    var DELIVERY_TARIF = 20,
        MINIMUM_COST = 500;

    return Math.max(len * DELIVERY_TARIF, MINIMUM_COST);
};

ymaps.ready(init);
