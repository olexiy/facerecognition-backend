/* eslint-disable no-console */
const express = require('express');
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const knex = require('knex');

const postgres = knex({
  client: 'pg',
  version: '12',
  connection: {
    host: 'localhost',
    port: '5433',
    user: 'postgres',
    password: 'nimda',
    database: 'postgres',
    shema: 'smart-brain',
  },
});

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());


app.get('/profile/:id', (req, res) => {
  const { id } = req.params;
  postgres.select('*').from('users').where({ id }).then((user) => {
    if (user.length) {
      res.json(user[0]);
    } else {
      res.status(400).json('User not found.');
    }
  })
    .catch((err) => res.status(400).json('error getting user'));
});

app.post('/image', (req, res) => {
  const { id } = req.body;
  postgres('users').where('id', '=', id)
    .increment('entries', 1)
    .returning('entries')
    .then((entries) => {
      res.json(entries[0]);
    })
    .catch((err) => res.status(400).json('unable to get entries'));
});

app.post('/signin', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json('incorrect form submission');
  }
  postgres.select('email', 'hash').from('login')
    .where('email', '=', email)
    .then((data) => {
      const isValid = bcrypt.compareSync(password, data[0].hash);
      if (isValid) {
        return postgres.select('*').from('users')
          .where('email', '=', email)
          .then((user) => {
            res.json(user[0]);
          })
          .catch((err) => res.status(400).json('unable to get user'));
      }
      res.status(400).json('wrong credentials');
    })
    .catch((err) => res.status(400).json('wrong credentials'));
});

app.post('/register', (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json('incorrect form submission');
  }
  const hash = bcrypt.hashSync(password);
  postgres.transaction((trx) => {
    trx.insert({
      hash,
      email,
    })
      .into('login')
      .returning('email')
      .then((loginEmail) => trx('users')
        .returning('*')
        .insert({
          email: loginEmail[0],
          name,
          joined: new Date(),
        })
        .then((user) => {
          res.json(user[0]);
        }))
      .then(trx.commit)
      .catch(trx.rollback);
  })
    .catch((err) => res.status(400).json('unable to register'));
});

app.listen(3000, () => {
  console.log('app is running on port 3000');
});
