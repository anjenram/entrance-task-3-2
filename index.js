const inputData = require('./data/input.json');
const moment = require('moment') //работа со времением


const TimeFunction = (data) => {
    const TimesOfDay = {
      day: [],
      night: [],
      dLong: {},
      nLong: {},
    }
    const timeDiff = (to, from) => {
      let DiffTo = moment(to, 'hours') /*.add(to, 'hours');*/
      let DiffFrom = moment(from, 'hours') /*.add(from, 'hours');*/
      if (to < from) DiffTo.add(24, 'hours')
      return DiffTo.diff(DiffFrom, 'hour');
    }
    const getMinVaule = (data) => {
      var min = 0;
      var dataValues = []
      if (typeof data === 'array' || typeof data === 'object') {
        data.forEach(el => {
          dataValues.push(el.value)
        });
        min = Math.min(...dataValues)
      }
      return min;
    }
    const getRateMinValue = (data) => {
      let rate = data.filter(obj => {
        return obj.value === getMinVaule(data)
      });
      return rate[0];
    }
    const getDurationMinValue = data => {
      let minDurationTo = getRateMinValue(data).to
      let minDurationFrom = getRateMinValue(data).from
      return timeDiff(minDurationTo, minDurationFrom)
    }
    data.forEach((rate) => {
      let cycleTime = timeDiff(rate.to, rate.from)
      if (rate.from < 21) { //day
        if (cycleTime >= 5) {
          TimesOfDay.dLong.rate = rate
          TimesOfDay.dLong.duration = cycleTime
        }
        TimesOfDay.day.push(rate);
      }
      if (rate.from >= 21) { //night
        if (cycleTime >= 5) {
          TimesOfDay.nLong.rate = rate
          TimesOfDay.nLong.duration = cycleTime
        }
        TimesOfDay.night.push(rate);
      }
    })
    const getMinValueDay = () => {
      return {
        rate: getRateMinValue(TimesOfDay.day),
        duration: getDurationMinValue(TimesOfDay.day)
      }
    };
    const getMinValueNight = () => {
      return {
        rate: getRateMinValue(TimesOfDay.night),
        duration: getDurationMinValue(TimesOfDay.night)
      }
    };
    const getValueAllTime = (power) => {
      let sum = 0;
      let rates = [...TimesOfDay.day, ...TimesOfDay.night]
      rates.forEach((rate) => {
        sum = sum + (((timeDiff(rate.to, rate.from) * power) / 1000) * rate.value)
      })
      return sum;
    }
    return { ...TimesOfDay,
      minValueDay: getMinValueDay(),
      minValueNight: getMinValueNight(),
      absolute: {
        rate: getRateMinValue(data),
        duration: getDurationMinValue(data)
      },
      valueAllTime: getValueAllTime,
      timeDiff: timeDiff
    }
  
  };
  const DeviceFunction = (data) => {
    const schedule = {};
    const consumedEnergy = {
      value: 0,
      devices: {}
    };
    const TimeParam = TimeFunction(data.rates)
    for (let i = 0; i <= 23; i++) {
      schedule[i] = {
        ids: [],
        power: 0
      }
    };
    data.devices.forEach((device) => {
      if (device.power < data.maxPower) {
        if (device.duration === 24) {
          let deviceValue = TimeParam.valueAllTime(device.power)
          let status = false;
          for (let i = 0; i < device.duration; i++) {
            if (schedule[i].power + device.power < data.maxPower) {
              status = true
              schedule[i].ids.push(device.id);
              schedule[i].power += device.power
            }
          }
          if (status) {
            consumedEnergy.devices[device.id] = deviceValue;
            consumedEnergy.value += deviceValue;
          }
        }
        if (device.mode === 'day') {
          let status = false;
          if (device.duration <= 5) {
            if (device.duration <= TimeParam.minValueDay.duration) {
              for (let i = 0, total = device.duration; i < total; i++) {
                if (schedule[TimeParam.minValueDay.rate.from + i].power + device.power < data.maxPower) {
                  schedule[TimeParam.minValueDay.rate.from + i].ids.push(device.id)
                } else {
                  total++
                }
                if (TimeParam.minValueDay.duration <= total) {
                  break;
                } else {
                  status = true
                }
              }
              if (status) {
                let deviceValue = ((device.duration * device.power) / 1000) * TimeParam.minValueDay.rate.value;
                consumedEnergy.devices[device.id] = deviceValue;
                consumedEnergy.value += deviceValue;
              }
            } else {
              let rate = TimeParam.day.filter(obj => {
                let res = TimeParam.timeDiff(obj.to, obj.from) >= device.duration
                return res;
              })[0];
              for (let i = 0, total = device.duration; i < total; i++) {
                if (schedule[rate.from + i].power + device.power < data.maxPower) {
                  schedule[rate.from + i].ids.push(device.id)
                } else {
                  total++
                }
                if (TimeParam.timeDiff(rate.to, rate.from) <= total) {
                  break;
                } else {
                  status = true
                }
              }
              if (status) {
                let deviceValue = ((device.duration * device.power) / 1000) * rate.value;
                consumedEnergy.devices[device.id] = deviceValue;
                consumedEnergy.value += deviceValue;
              }
            }
          } else {
            for (let i = 0, total = device.duration; i < total; i++) {
              if (schedule[TimeParam.dlong.rate.from + i].power + device.power < data.maxPower) {
                schedule[TimeParam.dlong.rate.from + i].ids.push(device.id)
              } else {
                total++
              }
              if (TimeParam.dlong.duration <= total) {
                break;
              } else {
                status = true
              }
            }
            if (status) {
              let deviceValue = ((device.duration * device.power) / 1000) * TimeParam.dlong.rate.value;
              consumedEnergy.devices[device.id] = deviceValue;
              consumedEnergy.value += deviceValue;
            }
          }
        }
        if (device.mode === 'night') {
          let status = false;
          if (device.duration <= 5) {
            if (device.duration <= TimeParam.minValueNight.duration) {
              for (let i = 0, total = device.duration; i < total; i++) {
                if (schedule[0 + i].power + device.power < data.maxPower) {
                  schedule[0 + i].ids.push(device.id)
                } else {
                  total++
                }
                if (TimeParam.minValueNight.duration <= total) {
                  break;
                } else {
                  status = true
                }
              }
              if (status) {
                let deviceValue = ((device.duration * device.power) / 1000) * TimeParam.minValueNight.rate.value;
                consumedEnergy.devices[device.id] = deviceValue;
                consumedEnergy.value += deviceValue;
              }
            } else {
              let rate = TimeParam.night.filter(obj => {
                return TimeParam.timeDiff(obj.to, obj.from) >= device.duration
              });
              for (let i = 0, total = device.duration; i < total; i++) {
                if (schedule[rate.from + i].power + device.power < data.maxPower) {
                  schedule[rate.from + i].ids.push(device.id)
                } else {
                  total++
                }
                if (TimeParam.timeDiff(rate.to, rate.from) <= total) {
                  break;
                } else {
                  status = true
                }
              }
              if (status) {
                let deviceValue = ((device.duration * device.power) / 1000) * rate.value;
                consumedEnergy.devices[device.id] = deviceValue;
                consumedEnergy.value += deviceValue;
              }
            }
          } else {
            for (let i = 0, total = device.duration; i < total; i++) {
              if (schedule[TimeParam.nLong.rate.from + i].power + device.power < data.maxPower) {
                schedule[TimeParam.nLong.rate.from + i].ids.push(device.id)
              } else {
                total++
              }
              if (TimeParam.nLong.duration <= total) {
                break;
              } else {
                status = true
              }
            }
            if (status) {
              let deviceValue = ((device.duration * device.power) / 1000) * TimeParam.nLong.rate.value;
              consumedEnergy.devices[device.id] = deviceValue;
              consumedEnergy.value += deviceValue;
            }
          }
        }
        if (!device.mode && device.duration !== 24) {
          let status = false;
          if (TimeParam.absolute.duration >= device.duration) {
            for (let i = 0, total = device.duration; i < total; i++) {
              if (schedule[TimeParam.absolute.rate.from + i].power + device.power < data.maxPower) {
                schedule[TimeParam.absolute.rate.from + i].ids.push(device.id)
              } else {
                total++
              }
              if (TimeParam.absolute.duration <= total) {
                break;
              } else {
                status = true
              }
            }
            if (status) {
              let deviceValue = ((device.duration * device.power) / 1000) * TimeParam.absolute.rate.value;
              consumedEnergy.devices[device.id] = deviceValue;
              consumedEnergy.value += deviceValue;
            }
          }
        }
      }
    })
    for (let key in schedule) {
      let tmp = schedule[key].ids
      schedule[key] = tmp;
    }
    return {
      schedule,
      consumedEnergy
    }
  }
  console.log(DeviceFunction(inputData))