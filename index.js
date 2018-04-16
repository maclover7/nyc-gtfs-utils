const moment = require('moment');
const ProtoBuf = require('protobufjs');

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
  return new Promise((resolve, reject) => {
    var trainDb = {};
    var msg;

    try {
      msg = feedMessage.decode(body);
    } catch (e) {
      console.error(e);
      return;
    }

    msg.entity.forEach((entity) => {
      if (!entity.tripUpdate) return;
      var nyctDescriptor = entity.tripUpdate.trip['.nyctTripDescriptor'];
      onEntity(nyctDescriptor);

      entity.tripUpdate.stopTimeUpdate.forEach((stopTimeUpdate) => {
        var time;

        if (stopTimeUpdate.arrival && stopTimeUpdate.arrival.time) {
          time = stopTimeUpdate.arrival.time.low;
        } else if (stopTimeUpdate.departure && stopTimeUpdate.departure.time) {
          time = stopTimeUpdate.departure.time.low;
        } else {
          time = '';
        }

        onStopTimeUpdate({
          direction: directionMap[nyctDescriptor.direction],
          stopId: stopTimeUpdate.stopId.slice(0, -1),
          time: moment.unix(time),
          trainId: nyctDescriptor.trainId
        });
      });
    });

    resolve();
  });
};

module.exports = {
  getFeeds,
  loadProtobufAssets,
  processProtobuf
};
