<img src="https://user-images.githubusercontent.com/1423657/55069501-8348c400-5084-11e9-9931-fefe0f9874a7.png" width=140/>

# HEPSUB RTP:Engine Endpoint

[HOMER](https://github.com/sipcapture/homer-app) Seven allows external agents to subscribe capabilities to provide *"on-demand"* session details from external APIs, databases, etc. to argument internally available data without requiring data duplication and allowing creative use of the core HEP platform.

This HEPSUB client will receive on-demand request from HOMER sessions, and will attempt locate RTP:Engine metadata and recordings.

```
[ HOMER ] <---> [ HEPSUB-RTPENGINE ] <---> [ RTPENGINE META ]
```

<img src="https://user-images.githubusercontent.com/1423657/96284862-7aa93d00-0fde-11eb-8424-de123e71c1a5.gif" width=600 />

<img src="https://user-images.githubusercontent.com/1423657/96286483-ba712400-0fe0-11eb-928e-7acb8ff969ef.png" width=600 />

##### Install
```
npm install
```
##### Configure
Configure your HOMER URL, `API Token` and local network settings in file `config.js`

##### Initialize
```
npm start
```

##### Docker
To use our ready container, just populate the following variables and use the included `docker-compose` file:
```
      - PUBLIC_IP=   YOUR SERVICE IP/DOMAIN
      - HOMER_IP=    YOUR HOMER IP
      - HOMER_PORT=  YOUR HOMER PORT
      - HOMER_TOKEN= YOUR HOMER AUTH TOKEN
```

---------

#### Made by Humans
This Open-Source project is made possible by actual Humans without corporate sponsors, angels or patreons.<br>
If you use this software in production, please consider supporting its development with contributions or [donations](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=donation%40sipcapture%2eorg&lc=US&item_name=SIPCAPTURE&no_note=0&currency_code=EUR&bn=PP%2dDonationsBF%3abtn_donateCC_LG%2egif%3aNonHostedGuest)

[![Donate](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=donation%40sipcapture%2eorg&lc=US&item_name=SIPCAPTURE&no_note=0&currency_code=EUR&bn=PP%2dDonationsBF%3abtn_donateCC_LG%2egif%3aNonHostedGuest) 

###### (C) 2008-2020 QXIP BV
