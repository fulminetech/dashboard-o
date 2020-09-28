#!/bin/bash
echo "[ Starting dashboard ]"

#Expand filestorage
sudo raspi-config --expand-rootfs 

#Install npm
sudo apt install npm

#Download node  installer (Will have to delete old one manually) Run ``sudo n`` and install latest node version 
sudo npm install n pm2 -g

#Download node --> https://docs.influxdata.com/influxdb/v1.8/introduction/install/

#Clone Dashboard
cd ~
git clone https://github.com/fulminetech/dashboard-o

# To start the service
cd dashboard-o
npm run install

# Spawn and daemonise systemctl
#sudo systemctl start influxd && sudo systemctl enable influxd 

#sleep 2
#sudo reboot -fn
echo "[ INSTALLATION COMPLETE ]"
