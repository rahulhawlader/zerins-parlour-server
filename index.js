const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');




app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mie68sk.mongodb.net/?retryWrites=true&w=majority`;



const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function varifyJWT(req, res, next) {
  // console.log('abc');
  const authHeader = req.headers.authorization;
  if (!authHeader) {
      return res.status(401).send({ message: 'UnAuthorized access' })
  }
  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
      if (err) {
          return res.status(403).send({ message: 'Forbidden access' })
      }
      req.decoded = decoded;
      next();
  })
}


async function run() {

  try {
    await client.connect();
    const serviceCollection = client.db('jerin-parlour').collection('services')
    const bookingCollection = client.db('jerin-parlour').collection('booking');
    const userCollection = client.db('jerin-parlour').collection('users');
    const reviewCollection = client.db('jerin-parlour').collection('review');



    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });
      if (requesterAccount.role === 'admin') {
          next();
      }
      else {
          res.status(403).send({ message: 'forbidden' });
      }
  }



    app.get('/service', async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const services = await cursor.toArray()
      res.send(services);

    })
    //////////////////////////////////////////////////////////////////////////
    app.get('/booking', varifyJWT, async (req, res) => {
      const patient = req.query.patient;
      
      const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }


    })


    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
      const exists = await bookingCollection.findOne(query);

      if (exists) {
        return res.send({ success: false, booking: exists })
      }
      const result = await bookingCollection.insertOne(booking);



      return res.send({ success: true, result })
    })
    // ///////////////////////////////////f//////////f//////f/////////////////////

    app.get('/user', varifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users)
  })

  app.get('/admin/:email', async (req, res) => {
    const email = req.params.email;
    const user = await userCollection.findOne({ email: email });
    const isAdmin = user.role === 'admin';
    res.send({ admin: isAdmin })
})




  app.put('/user/admin/:email', varifyJWT, verifyAdmin, async (req, res) => {
    const email = req.params.email;


    const filter = { email: email };


    const updateDoc = {
        $set: { role: 'admin' },
    };
    const result = await userCollection.updateOne(filter, updateDoc);

    res.send(result)
   

})





    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true }

      const updateDoc = {
          $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ result, token })
  })

    ///////////////////////////////////////////////////////////////////////////////

    app.get('/available', async (req, res) => {
      const date = req.query.date;
      const services = await serviceCollection.find().toArray();
      const query = { date: date };
      const booking = await bookingCollection.find(query).toArray();

      services.forEach(service => {
        const serviceBookings = booking.filter(book => book.treatment === service.name);
        const booked = serviceBookings.map(book => book.slot);
        const available = service.slots.filter(slot => !booked.includes(slot));
        service.slots = available

      })

      res.send(services)
    })




    // ///////////////////////////////////////////////////


    app.post('/review', async (req, res) => {
      const newReview = req.body;
      const result = await reviewCollection.insertOne(newReview);
      res.send(result)
    })


  }
  finally {

  }


}
run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('Hello from jerin apa!')
})

app.listen(port, () => {
  console.log(`parlour app listening on port ${port}`)
})