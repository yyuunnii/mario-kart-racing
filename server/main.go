}
}

func (s *Server) handleGetRooms(p *Player) {
	s.mu.RLock()
	rooms := make([]*Room, 0, len(s.rooms))
	for _, room := range s.rooms {
		if room.GameState == "waiting" {
			rooms = append(rooms, room)
		}
	}
	s.mu.RUnlock()
	
	p.Conn.WriteJSON(map[string]interface{}{
		"type":  "roomsList",
		"rooms": rooms,
	})
}

func (s *Server) handleDisconnect(p *Player) {
	s.mu.Lock()
	delete(s.players, p.ID)
	s.mu.Unlock()
	
	// 从房间中移除
	for _, room := range s.rooms {
		if _, exists := room.Players[p.ID]; exists {
			room.removePlayer(p.ID)
			if len(room.Players) == 0 {
				s.removeRoom(room.ID)
			} else {
				// 如果房主断开，转移房主
				if room.HostID == p.ID && len(room.Players) > 0 {
					for _, newHost := range room.Players {
						room.HostID = newHost.ID
						break
					}
				}
				room.broadcastState()
			}
			break
		}
	}
	
	if p.Conn != nil {
		p.Conn.Close()
	}
}

func main() {
	rand.Seed(time.Now().UnixNano())
	
	server := NewServer()
	
	// WebSocket 端点
	http.HandleFunc("/ws", server.handleWebSocket)
	
	// 静态文件服务
	http.Handle("/", http.FileServer(http.Dir("../")))
	
	port := ":8080"
	log.Printf("服务器启动在 http://localhost%s", port)
	log.Fatal(http.ListenAndServe(port, nil))
}