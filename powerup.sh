#!/bin/bash
echo "[ Starting dashboard ]"

#Expand filestorage
# sudo raspi-config --expand-rootfs && sudo apt install npm

#Clone Dashboard
cd ~
git clone https://github.com/marutimuthu/dashboard

#Remove old modules
rm -rf ~/dashboard/node_modules/

#Install fresh modules
cd ~/dashboard/

# To start the service
npm run live

# Spawn and daemonise systemctl
# sudo systemctl start influxd && sudo systemctl enable influxd 

#sleep 2
#sudo reboot -fn
echo "[ INSTALLATION COMPLETE ]"
