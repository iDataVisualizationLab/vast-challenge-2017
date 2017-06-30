'use strict';
class DepartureMonthlyGateHeatMap extends GateTimeHeatMap {

    constructor(divId, width, height, options) {
        super(divId, width, height, options);
    }

    static createTimes() {
        let times = ["Ja", "Fe", "Mar", "Apr", "May", "Jun", "Jul", 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return times;
    }

    handleTimeData(visits, depart) {
        let self = this;
        let myData = self.objectData;
        let key;
        let time;
        let gate;
        let tmpData;

        let paths;

        visits.forEach(function (l) {

            paths = l.path;
            let preCp;

            paths.forEach(function (cp, index) {

                if (index < 1) {
                    return;
                }

                preCp = paths[index-1];
                gate = cp.getGate();

                if (preCp.getGate() != gate || gate.startsWith('entrance')) {
                    return;
                }

                // we are interested in gates where it stops for a while
                let departTime = new Date(cp.getTime().getTime());
                time = departTime.getMonth();
                key = gate + '-' + time;

                if (!myData.hasOwnProperty(key)) {
                    throw  new Error('invalid data, double check if it has been initialized');
                }

                tmpData = myData[key];
                tmpData.count ++;

            });
        });

        return myData;
    }
}