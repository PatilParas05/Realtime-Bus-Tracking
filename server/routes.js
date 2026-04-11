app.get('/driver',    (req, res) => res.sendFile(path.join(__dirname, '../public/driver.html')));
app.get('/passenger', (req, res) => res.sendFile(path.join(__dirname, '../public/passenger.html')));