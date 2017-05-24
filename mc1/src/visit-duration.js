var VisitDuration = function VisitDuration(visitChart, parkMap) {

    this.visitChart = visitChart;
    this.parkMap = parkMap;

    this.parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

    let minDate = this.parseTime('2015-05-01 00:43:28');
    let maxDate = this.parseTime('2016-05-31 23:56:06');

    this.visitChart.setXDomain(minDate, maxDate);
    this.visitChart.setYDomain(0, 20000);

    this.init();

};


VisitDuration.prototype.init = function init() {
    this.events = [
        {name: 'mouseover', callback: this.onLineMouseOver, params: this},
        // {name: 'mouseout', callback: this.onLineMouseOut, params: this}
    ];

};

VisitDuration.prototype.render = function render(lines) {

    let colorFunction = d3.scaleOrdinal(d3.schemeCategory10);
    // parse the date / time
    let self = this;
    lines.forEach(function(line, index) {

        let colorIdx = line.carType;
        let color = line.carType == '2P' ? '#000000' : colorFunction(colorIdx);
        line.color = color;

        let path = line.path.map(function (timeGate) {
            let carPoint;
            let mapPoint = self.parkMap.getMapPointByName(timeGate.gate);

            carPoint = new CarPoint(mapPoint, self.parseTime(timeGate.time));
            carPoint.y = 50 + index;

            return carPoint;
        });

        delete line.path;
        self.visitChart.addData(line, path, 'time', 'y');

    });

    this.visitChart.renderChart(this.events);
    this.visitChart.renderAxis('Time', 'Visit');
};

VisitDuration.prototype.onLineMouseOver = function onLineMouseOver(param, line) {
    console.log('event mouse over');

    let self = param;

    // let mapPointPaths = line.data.map(function (carPoint) {
    //     return carPoint.getMapPoint();
    // });
    // self.parkMap.findThenHighLightPath(mapPointPaths, line.context.color);

    // self.renderCarTrace(line.data[0], 0, 0);

    self.simulateCarMovement(line.context, line.data);

};

VisitDuration.prototype.onLineMouseOut = function onLineMouseOver(param, line) {
    let path = line.data;
    let startPoint;
    let endPoint;
    let steps;

    let self = param;

    for(let i=0; i< path.length-1; i++) {
        startPoint = path[i];
        endPoint = path[i+1];

        steps = self.parkMap.findSinglePathByName(startPoint.gate, endPoint.gate);
        self.parkMap.clearPath(steps);
    }
};

VisitDuration.prototype.simulateCarMovement = function (context, gateSensorDataArray) {

    let self = this;

    if (!!self.simulationTimer) {
        self.simulationTimer.stop();
        self.parkMap.clearCarTrace();

        if (!!self.simulatedMapPoints && self.simulatedMapPoints.length > 0) {
            self.parkMap.clearPath(self.simulatedMapPoints);
            self.simulatedMapPoints = [];
        }
    }

    console.log('Simulating for car: ' + context.carId + "; type: " + context.carType);
    let timeDurationInMiliSecond;
    let fromCarPoint;
    let toCarPoint;
    let distance;

    self.simulationPath = [];
    self.simulatedMapPoints = [];

    let velocity;

    for(let i=0; i< gateSensorDataArray.length - 1; i++) {
        fromCarPoint = gateSensorDataArray[i];
        toCarPoint =  gateSensorDataArray[i+1];
        timeDurationInMiliSecond = toCarPoint.getTimeInMiliseconds() - fromCarPoint.getTimeInMiliseconds();

        if (fromCarPoint.getGate() != toCarPoint.getGate()) {
            distance = this.parkMap.findSinglePathByName(fromCarPoint.getGate(), toCarPoint.getGate());
            distance.shift(); // avoid counting current position
            velocity = distance.length * ParkMap.CELL_WIDTH_IN_MILE * 3600000 / timeDurationInMiliSecond; // mile per hour
        }
        else {
            velocity = 0; // not movement, stay in side for gaming, camping
        }

        self.simulationPath.push({from: fromCarPoint, to: toCarPoint, velocity: velocity, path: distance, id: self.simulationPath.length})
    }

    var nextSimplePath = self.simulationPath.shift();

    // show car tace
    let carTrace = self.parkMap.getCarTraceContainer();
    carTrace.append('text')
        .text('Car: ' + context.carId)
        .attr('x', 13)
        .attr('y', 1)
        .style("font-size", "10px")

    ;


    var doSimulation = function (simplePath, index) {

        let myIndex = index % 35;
        if (myIndex == 0) {
            // clear text
            self.parkMap.clearCarTrace();
        }
        let carTraceYPos = 15 + myIndex*15;



        self.renderCarTrace(simplePath.from, 0, carTraceYPos);

        if (simplePath.from.getGate() == simplePath.to.getGate()) {
            console.log('enter and quite the same place: ' + simplePath.from.getGate() + "; duration: " + ((simplePath.to.getTimeInMiliseconds() - simplePath.from.getTimeInMiliseconds())/1000*60) + "(min)");
            nextSimplePath = self.simulationPath.shift();
            if (!!nextSimplePath) {

                doSimulation(nextSimplePath, ++index);
            }
            else {
                self.renderCarTrace(simplePath.to, 0, carTraceYPos + 15, true); // last gate
            }

            return;

        }

        console.log('Simulate Path: from: ' + simplePath.from.getGate() + "; t: " + simplePath.to.getGate());
        // highlight cell
        let nextCell = simplePath.path.shift();

        var doJumping = function (cell) {

            console.log('jump to cell: ' + cell.getPos() + "; name: " + cell.getName());
            self.simulatedMapPoints.push(cell);

            self.parkMap.highLightOneCell(cell, context.color);

            self.simulationTimer = d3.timer(function (e) {
                    // clear cell
                    // console.log('out of cell : ' + cell.getPos());
                    self.simulationTimer.stop();
                    // self.parkMap.clearOneCell(cell);

                    nextCell = simplePath.path.shift();
                    if (!!nextCell) {
                        doJumping(nextCell);
                    }
                    else {
                        nextSimplePath = self.simulationPath.shift();
                        if (!!nextSimplePath) {

                            doSimulation(nextSimplePath, ++index);
                        }else {

                            self.renderCarTrace(simplePath.to, 0, carTraceYPos + 15, true); // last gate

                        }
                    }


                },
                simplePath.velocity
            );
        };

        doJumping(nextCell);
    };

    doSimulation(nextSimplePath, 0);
};

VisitDuration.prototype.renderCarTrace = function renderCarTrace(carPoint, x, y, end) {

    let carTrace = this.parkMap.getCarTraceContainer();
    x = !!x ? x : 0;
    y = !!y ? y : 0;

    carTrace.append('rect')
        .attr('class', 'car-at-gate')
        .attr('width', 5)
        .attr('height', 5)
        .attr('fill', carPoint.getColor())
        .attr('x', x)
        .attr('y', y - 7)
    ;

    carTrace.append('text')
        .text(carPoint.getGate())
        .attr('x', x + 13)
        .attr('y', y)
        .style("font-size", "10px")
    ;

    carTrace.append('text')
        .text(carPoint.getFormattedTime())
        .attr('x', 80)
        .attr('y', y)
        .style("font-size", "10px")

    ;

    if (!!end) {
        carTrace.append('text')
            .text('Complete')
            .attr('x', x + 13)
            .attr('y', y + 15)
            .style("font-size", "10px")

        ;
    }
};

VisitDuration.prototype.highlightVisitsByEntranceType = function highlightVisitsByEntranceType (entranceType, vehicleCategory) {

    if (entranceType == 'multi-entrances') {
        this.visitChart.highLightMultiVisits(vehicleCategory);
    }
    else if (entranceType == 'single-entrance') {
        this.visitChart.highLightSingleVisit(vehicleCategory);
    }
    else if (entranceType == 'no-exit') {
        this.visitChart.highLightNoExit(vehicleCategory);
    }
    else {
        this.visitChart.highLightAllTypesOfVisit(vehicleCategory);

    }
};