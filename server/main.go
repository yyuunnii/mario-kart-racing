		for _, p := range players {
			if p.Conn != nil {
				p.Conn.WriteMessage(websocket.TextMessage, msg)
			}
		}
	}
}

func (r *Room) broadcastState() {
	state := map[string]interface{}{
		"type":      "gameState",
		"roomId":    r.ID,
		"state":     r.GameState,
		"players":   r.getPlayersList(),
		"countdown": r.CountdownValue,
		"itemBoxes": r.ItemBoxes,
		"projectiles": r.getProjectilesList(),
		"particles": r.getParticlesList(),
	}
	
	data, _ := json.Marshal(state)
	r.broadcast <- data
}

func (r *Room) getPlayersList() []*Player {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]*Player, 0, len(r.Players))
	for _, p := range r.Players {
		list = append(list, p)
	}
	return list
}

func (r *Room) getProjectilesList() []*Projectile {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]*Projectile, 0, len(r.Projectiles))
	for _, p := range r.Projectiles {
		list = append(list, p)
	}
	return list
}

func (r *Room) getParticlesList() []*Particle {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]*Particle, 0, len(r.Particles))
	for _, p := range r.Particles {
		list = append(list, p)
	}
	return list
}

func (r *Room) addPlayer(p *Player) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if len(r.Players) >= MAX_PLAYERS {
		return false
	}
	
	r.Players[p.ID] = p
	return true
}

func (r *Room) removePlayer(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Players, playerID)
}

func (r *Room) startGame() {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if r.GameState != "waiting" {
		return
	}
	
	// 初始化玩家位置
	startPositions := []Point{
		{X: 100, Y: 350},
		{X: 100, Y: 380},
		{X: 70, Y: 350},
		{X: 70, Y: 380},
	}
	
	i := 0
	for _, p := range r.Players {
		if i < len(startPositions) {
			p.X = startPositions[i].X
			p.Y = startPositions[i].Y
			p.VX = 0
			p.VY = 0
			p.Angle = 0
			p.Speed = 0
			p.Lap = 1
			p.Checkpoint = 0
			p.Finished = false
			p.FinishTime = 0
			p.CurrentLapStart = 0
			p.LapTimes = []int64{}
			p.BestLapTime = 0
			p.Item = ""
			p.Rank = 1
			i++
		}
	}
	
	// 重置道具箱
	for i := range r.ItemBoxes {
		r.ItemBoxes[i].Active = true
	}
	
	r.GameState = "countdown"
	r.CountdownValue = COUNTDOWN_TIME
	r.FinishedCount = 0
	
	// 启动倒计时
	go r.countdownLoop()
}

func (r *Room) countdownLoop() {
	for r.CountdownValue > 0 {
		r.broadcastState()
		time.Sleep(time.Second)
		r.mu.Lock()
		r.CountdownValue--
		r.mu.Unlock()
	}
	
	// GO!
	r.mu.Lock()
	r.GameState = "racing"
	r.GameStartTime = time.Now().UnixMilli()
	
	// 设置所有玩家的单圈开始时间
	for _, p := range r.Players {
		p.CurrentLapStart = r.GameStartTime
	}
	r.mu.Unlock()
	
	r.broadcastState()
	
	// 启动游戏循环
	r.startGameLoop()
}

func (r *Room) startGameLoop() {
	r.ticker = time.NewTicker(time.Duration(GAME_UPDATE_RATE) * time.Millisecond)
	
	go func() {
		for {
			select {
			case <-r.ticker.C:
				r.update()
			case <-r.stopGameLoop:
				r.ticker.Stop()
				return
			}
		}
	}()
}

func (r *Room) stopGame() {
	if r.ticker != nil {
		r.stopGameLoop <- true
	}
}

func (r *Room) update() {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if r.GameState != "racing" {
		return
	}
	
	now := time.Now().UnixMilli()
	
	// 更新所有玩家
	for _, p := range r.Players {
		r.updatePlayer(p, now)
	}
	
	// 更新投射物
	r.updateProjectiles()
	
	// 更新粒子
	r.updateParticles()
	
	// 检查游戏结束
	if r.FinishedCount >= len(r.Players) && len(r.Players) > 0 {
		r.GameState = "finished"
		r.stopGame()
	}
	
	r.mu.Unlock()
	r.broadcastState()
	r.mu.Lock()
}

func (r *Room) updatePlayer(p *Player, now int64) {
	if p.Finished {
		return
	}
	
	// 设置单圈开始时间
	if p.CurrentLapStart == 0 {
		p.CurrentLapStart = now
	}
	
	// 道具冷却
	if p.ItemCooldown > 0 {
		p.ItemCooldown--
	}
	
	// 无敌时间
	if p.InvincibleTime > 0 {
		p.InvincibleTime--
		if p.InvincibleTime <= 0 {
			p.MaxSpeed = CAR_TYPES[p.CarType].MaxSpeed
		}
	}
	
	// 缩小时间
	if p.ShrinkTime > 0 {
		p.ShrinkTime--
		if p.ShrinkTime <= 0 {
			p.Shrunk = false
			p.MaxSpeed *= 2
		}
	}
	
	// 漂移
	if p.IsDrifting {
		p.DriftTime++
		if p.DriftTime > 30 {
			p.BoostTime = 60
		}
	} else {
		p.DriftTime = 0
	}
	
	// 漂移加速
	if p.BoostTime > 0 {
		p.BoostTime--
	}
	
	// 表情
	if p.ExpressionTime > 0 {
		p.ExpressionTime--
		if p.ExpressionTime <= 0 {
			p.Expression = "normal"
		}
	}
	
	// 应用摩擦力
	p.VX *= p.Friction
	p.VY *= p.Friction
	p.Speed = math.Sqrt(p.VX*p.VX + p.VY*p.VY)
	
	// 处理输入
	carConfig := CAR_TYPES[p.CarType]
	boostMultiplier := 1.0
	if p.BoostTime > 0 {
		boostMultiplier = 1.5
	}
	
	// 转向
	if p.Input.Left {
		p.Angle -= carConfig.TurnSpeed
	}
	if p.Input.Right {
		p.Angle += carConfig.TurnSpeed
	}
	
	// 加速/减速
	if p.Input.Up {
		if p.Speed < carConfig.MaxSpeed*boostMultiplier {
			p.VX += math.Cos(p.Angle) * carConfig.Acceleration
			p.VY += math.Sin(p.Angle) * carConfig.Acceleration
		}
	}
	if p.Input.Down {
		if p.Speed < carConfig.MaxSpeed*0.5 {
			p.VX -= math.Cos(p.Angle) * carConfig.Acceleration * 0.5
			p.VY -= math.Sin(p.Angle) * carConfig.Acceleration * 0.5
		}
	}
	
	// 漂移
	p.IsDrifting = p.Input.Shift && p.Speed > 3
	
	// 使用道具
	if p.Input.Space && p.Item != "" && p.ItemCooldown == 0 {
		r.useItem(p)
	}
	
	// 更新位置
	p.X += p.VX
	p.Y += p.VY
	
	// 检查赛道位置
	r.checkTrackPosition(p)
	
	// 检查道具箱
	r.checkItemBoxes(p)
	
	// 检查检查点
	r.checkCheckpoints(p, now)
	
	// 边界检查
	r.checkBoundaries(p)
}

func (r *Room) checkTrackPosition(p *Player) {
	onTrack := false
	minDist := 999999.0
	
	for i := 0; i < len(r.TrackPoints); i++ {
		p1 := r.TrackPoints[i]
		p2 := r.TrackPoints[(i+1)%len(r.TrackPoints)]
		
		dist := pointToSegmentDistance(p.X, p.Y, p1.X, p1.Y, p2.X, p2.Y)
		if dist < minDist {
			minDist = dist
		}
		if dist < 60 {
			onTrack = true
		}
	}
	
	if !onTrack {
		p.VX *= 0.92
		p.VY *= 0.92
	}
}

func pointToSegmentDistance(px, py, x1, y1, x2, y2 float64) float64 {
	dx := x2 - x1
	dy := y2 - y1
	
	if dx == 0 && dy == 0 {
		return math.Sqrt((px-x1)*(px-x1) + (py-y1)*(py-y1))
	}
	
	t := ((px-x1)*dx + (py-y1)*dy) / (dx*dx + dy*dy)
	t = math.Max(0, math.Min(1, t))
	
	nx := x1 + t*dx
	ny := y1 + t*dy
	
	return math.Sqrt((px-nx)*(px-nx) + (py-ny)*(py-ny))
}

func (r *Room) checkItemBoxes(p *Player) {
	for i := range r.ItemBoxes {
		box := &r.ItemBoxes[i]
		if !box.Active {
			continue
		}
		
		dx := p.X - box.X
		dy := p.Y - box.Y
		dist := math.Sqrt(dx*dx + dy*dy)
		
		if dist < 30 && p.Item == "" {
			box.Active = false
			p.Item = r.randomItem()
			
			// 3秒后重生道具箱
			go func(idx int) {
				time.Sleep(3 * time.Second)
				r.mu.Lock()
				if idx < len(r.ItemBoxes) {
					r.ItemBoxes[idx].Active = true
				}
				r.mu.Unlock()
			}(i)
			break
		}
	}
}

func (r *Room) randomItem() string {
	items := []string{"MUSHROOM", "BANANA", "SHELL", "STAR", "LIGHTNING"}
	return items[rand.Intn(len(items))]
}

func (r *Room) useItem(p *Player) {
	if p.Item == "" {
		return
	}
	
	switch p.Item {
	case "MUSHROOM":
		p.BoostTime = 120
		p.Expression = "excited"
		p.ExpressionTime = 60
		
	case "BANANA":
		// 在身后放置香蕉皮
		banana := &Projectile{
			ID:      fmt.Sprintf("banana_%d", time.Now().UnixNano()),
			Type:    "banana",
			X:       p.X - math.Cos(p