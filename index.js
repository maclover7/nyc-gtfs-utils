const moment = require('moment');
const ProtoBuf = require('protobufjs');
const request = require('request-promise');

const getFeeds = (apiKey, nextFunc) => {
  for(var feedId of [1, 26, 16, 21, 2, 11, 31, 36, 51]) {
    request({
      url: `http://datamine.mta.info/mta_esi.php?key=${apiKey}&feed_id=${feedId}`,
      encoding: null
    }).then(nextFunc);
  }
};

const loadProtobufAssets = () => {
  return ProtoBuf
    .load(`${require.resolve('nyc-gtfs-utils').split('index.js')[0]}nyct-subway.proto`)
    .then((root) => {
      return new Promise((resolve, reject) => {
        resolve([
          root.lookupType("FeedMessage"),
          root.lookupType("NyctTripDescriptor").nested.Direction.valuesById
        ]);
      });
    })
    .catch((err) => {
      console.error(err);
    });
};

const processProtobuf = (feedMessage, directionMap, body, onEntity, onStopTimeUpdate) => {
  var trainDb = {};

  return new Promise((resolve, reject) => {
    try {
      var msg = feedMessage.decode(body);
    } catch (e) {
      reject(e);
    }
    resolve(msg);
  })
  .then((msg) => {
    return msg.entity.map((entity) => {
       if (!entity.tripUpdate) return Promise.resolve();
       var nyctDescriptor = entity.tripUpdate.trip['.nyctTripDescriptor'];

       onEntity({
         trainId: nyctDescriptor.trainId,
         direction: directionMap[nyctDescriptor.direction]
       })
       .then(() => {
         return entity.tripUpdate.stopTimeUpdate.map((stopTimeUpdate) => {
           var stopId = stopTimeUpdate.stopId.slice(0, -1);
           var time;

           if (stopTimeUpdate.arrival && stopTimeUpdate.arrival.time) {
             time = stopTimeUpdate.arrival.time.low;
           } else if (stopTimeUpdate.departure && stopTimeUpdate.departure.time) {
             time = stopTimeUpdate.departure.time.low;
           } else {
             time = '';
           }

           return onStopTimeUpdate({
             direction: directionMap[nyctDescriptor.direction],
             stopId: stopTimeUpdate.stopId.slice(0, -1),
             time: moment.unix(time),
             trainId: nyctDescriptor.trainId
           });
         });
       });
    });
  })
  .catch((e) => {
    console.error(e);
  });
};

module.exports = {
  getFeeds,
  loadProtobufAssets,
  processProtobuf
};
