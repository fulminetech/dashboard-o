#!/bin/bash
echo "[ Starting dashboard ]"

#Expand filestorage
sudo raspi-config --expand-rootfs && sudo apt install npm

#Clone Dashboard
cd ~
git clone https://github.com/fulminetech/dashboard-o

# To start the service
cd dashboard-o
npm run live

# Spawn and daemonise systemctl
sudo systemctl start influxd && sudo systemctl enable influxd 

#sleep 2
#sudo reboot -fn
echo "[ INSTALLATION COMPLETE ]"
