#!/bin/bash
echo "[ Starting dashboard ]"

#Expand filestorage
sudo raspi-config --expand-rootfs 

#Install npm
sudo apt install npm

#Download node  installer (Will have to delete old one manually) Run ``sudo n`` and install latest node version 
sudo npm install n pm2 -g

#Install influx and create database new --> https://docs.influxdata.com/influxdb/v1.8/introduction/install/ sudo systemctl disable influxdb.service then sudo systemctl start influxdb.service

#Clone Dashboard
cd ~
git clone https://github.com/fulminetech/dashboard-o

# To start the service
cd dashboard-o    
npm run install

## NGROK
#make executable
chmod +x /home/pi/dashboard-o/ngrok
#authenticate
/home/pi/dashboard-o/ngrok authtoken 1j8PqqUL4upC2O3SFkJigL57kXM_bhFyo9KsG7SZYbunNvRs

# Spawn and daemonise systemctl
#sudo systemctl start influxd && sudo systemctl enable influxd 

#sleep 2
#sudo reboot -fn
echo "[ INSTALLATION COMPLETE ]"
