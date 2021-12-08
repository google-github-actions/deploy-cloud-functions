/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */

let fs = require('fs');

exports.helloWorld = (req, res) => {
  // Still send a 200 so we get the response (gaxios and other libraries barf on
  // non-200)
  if (!fs.existsSync('.dotfile')) {
    res.status(200).send('Dotfile does not exist!');
    return;
  }

  let message = req.query.message || req.body.message || 'Hello World!!';
  res.status(200).send(message);
};
