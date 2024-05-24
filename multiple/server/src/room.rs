use std::sync::Mutex;

use actix::Addr;

use crate::websocket::WebSocket;

pub struct Room {
    users: Mutex<Vec<Addr<WebSocket>>>,
}

impl Room {
    pub fn new() -> Self {
        Self {
            users: Mutex::new(Vec::new()),
        }
    }

    pub fn add_user(&self, user: Addr<WebSocket>) {
        let mut users = self.users.lock().unwrap();
        users.push(user);
    }

    pub fn remove_user(&self, user: Addr<WebSocket>) {
        let mut users = self.users.lock().unwrap();
        users.retain(|u| u != &user);
    }

    pub fn get_peers(&self, user: &Addr<WebSocket>) -> Vec<Addr<WebSocket>> {
        let users = self.users.lock().unwrap();
        users.iter().filter(|u| u != &user).cloned().collect()
    }
}
