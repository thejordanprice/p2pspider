# p2pspider

Daemon that scrapes the DHT swarm and an express bootstrapped front-end connected to the same mongodb to create an automated magnet db with search.

### Intro

This can index over 1 million magnets per 24/hr on 2GB of RAM and around 2MB/s connection. It is a RAM/CPU hog though, it will consume 100% of the CPU and the RAM if allowed and can be controlled via the 'ecosystem.json' file. On a 2GB RAM it is suggested to use 8 instances of the daemon and 2 of the webserver; all limited at 175MB.

###### Screenshots

![Screenshot][index]
![Screenshot][search]

[index]: https://i.imgur.com/dEix8Mo.png "index page"
[search]: https://i.imgur.com/oAlu63z.png "search page"

### Getting Started

    apt install mongodb
    npm install -g pm2
    npm install
    pm2 start ecosystem.json
    pm2 monit

### Protocols

[bep_0005](http://www.bittorrent.org/beps/bep_0005.html), [bep_0003](http://www.bittorrent.org/beps/bep_0003.html), [bep_0010](http://www.bittorrent.org/beps/bep_0010.html), [bep_0009](http://www.bittorrent.org/beps/bep_0009.html)

### Notes

Cluster mode will not and will never work on Windows... With other OSs we can get multiple instances listening on the same UDP port.

You will need to have a port open on the outside and defined, by default it is 6881.

### Notice

Please don't share the data p2pspider crawled to the internet. Because sometimes it crawls sensitive/copyrighted/porn data.

## License

MIT
