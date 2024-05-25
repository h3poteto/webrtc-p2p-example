use std::sync::Arc;

use actix::{Actor, ActorContext, AsyncContext, Handler, Message, StreamHandler};
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};

use crate::room;

pub struct WebSocket {
    pub room: Arc<room::Room>,
}

impl WebSocket {
    pub fn new(room: Arc<room::Room>) -> Self {
        Self { room }
    }
}

impl Actor for WebSocket {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        tracing::info!("WebSocket started");
        let address = ctx.address();
        self.room.add_user(address);
    }

    fn stopped(&mut self, ctx: &mut Self::Context) {
        tracing::info!("WebSocket stopped");
        let address = ctx.address();
        self.room.get_peers(&address).iter().for_each(|peer| {
            peer.do_send(SendingMessage::Close);
        });
        self.room.remove_user(address);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WebSocket {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                tracing::info!("Pong received");
            }
            Ok(ws::Message::Text(text)) => match serde_json::from_str::<ReceivedMessage>(&text) {
                Ok(message) => ctx.address().do_send(message),
                Err(e) => {
                    tracing::error!("Error: {}", e);
                }
            },
            Ok(ws::Message::Binary(bin)) => {
                ctx.binary(bin);
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => (),
        }
    }
}

impl Handler<ReceivedMessage> for WebSocket {
    type Result = ();

    fn handle(&mut self, msg: ReceivedMessage, ctx: &mut Self::Context) {
        let address = ctx.address();
        match msg {
            ReceivedMessage::Open => {
                self.room.get_peers(&address).iter().for_each(|peer| {
                    peer.do_send(SendingMessage::Answer);
                });
                address.do_send(SendingMessage::Offer);
            }
            ReceivedMessage::Ping => {
                address.do_send(SendingMessage::Pong);
            }
            ReceivedMessage::Ice { candidate } => {
                self.room.get_peers(&address).iter().for_each(|peer| {
                    peer.do_send(SendingMessage::Ice {
                        candidate: candidate.clone(),
                    });
                });
            }
            ReceivedMessage::Sdp { sdp } => {
                self.room.get_peers(&address).iter().for_each(|peer| {
                    peer.do_send(SendingMessage::Sdp { sdp: sdp.clone() });
                });
            }
        }
    }
}

impl Handler<SendingMessage> for WebSocket {
    type Result = ();

    fn handle(&mut self, message: SendingMessage, ctx: &mut Self::Context) {
        ctx.text(serde_json::to_string(&message).unwrap());
    }
}

#[derive(Deserialize, Message, Debug, Clone)]
#[serde(tag = "action")]
#[rtype(result = "()")]
enum ReceivedMessage {
    #[serde(rename_all = "camelCase")]
    Open,
    #[serde(rename_all = "camelCase")]
    Ice { candidate: String },
    #[serde(rename_all = "camelCase")]
    Sdp { sdp: String },
    #[serde(rename_all = "camelCase")]
    Ping,
}

#[derive(Serialize, Message, Debug)]
#[serde(tag = "action")]
#[rtype(result = "()")]
pub enum SendingMessage {
    #[serde(rename_all = "camelCase")]
    Offer,
    #[serde(rename_all = "camelCase")]
    Answer,
    #[serde(rename_all = "camelCase")]
    Pong,
    #[serde(rename_all = "camelCase")]
    Ice { candidate: String },
    #[serde(rename_all = "camelCase")]
    Sdp { sdp: String },
    #[serde(rename_all = "camelCase")]
    Close,
}
