# p2pspider

Daemon that scrapes the DHT swarm and an express bootstrapped front-end connected to the same mongodb to create an automated magnet db with search.

## Screenshots

![Screenshot][index]
![Screenshot][search]
![Screenshot][single]

[index]: https://i.imgur.com/ltJng3W.png "index page"
[search]: https://i.imgur.com/oAlu63z.png "search page"
[single]: https://i.imgur.com/yFJpDuT.png "single view"

## Dependencies

Node.js > 4

MongoDB

## Start

    apt install mongodb
    npm install -g pm2
    npm install
    pm2 start ecosystem.json
    pm2 monit

## Protocols

[bep_0005](http://www.bittorrent.org/beps/bep_0005.html), [bep_0003](http://www.bittorrent.org/beps/bep_0003.html), [bep_0010](http://www.bittorrent.org/beps/bep_0010.html), [bep_0009](http://www.bittorrent.org/beps/bep_0009.html)

## Notes

Cluster mode will not and will never work on Windows... With other OSs we can get multiple instances listening on the same UDP port.

You will need to have a port open on the outside and defined.

## Notice

Please don't share the data p2pspider crawled to the internet. Because sometimes it crawls sensitive/copyrighted/porn data.

## License

MIT
