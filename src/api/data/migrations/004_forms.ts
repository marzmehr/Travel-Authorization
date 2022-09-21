import * as knex from 'knex';

// create table Travel.Auth(
// 	TAId smallint not null GENERATED BY DEFAULT AS IDENTITY primary key,
// 	UserId smallint not null, --fk
// 	FirstName varchar (50), --autocompete using Directory API
// 	LastName varchar (50),
// 	Department varchar (100), --maybe there is an api we can use
// 	Division varchar(100),
// 	Branch varchar (100), -- maybe there is an api we can use
// 	Unit varchar (100),
// 	Email varchar (100),
// 	Mailcode varchar(10),
// 	DaysNotTravel smallint,
// 	DateBackToWork date,
// 	TravelDuration smallint,
// 	Purpose varchar(100),
// 	TravelAdvance integer,
// 	EventName varchar(100),
// 	Summary varchar(1000),
// 	FormStatus varchar(25) not null,
// 	FormId varchar(50) UNIQUE,
// 	SupervisorEmail varchar(100),
// 	PreappId smallint,
// 	Approved varchar(50),
// 	RequestChange varchar(2000),
// 	DenialReason varchar(2000),
// 	FOREIGN KEY (preappid) REFERENCES Travel.Preapprove(preappid)
// );

exports.up = function (knex: knex.Knex, Promise: any) {
	return knex.schema.createTable('forms', function (t) {
		t.increments('id').notNullable().primary();
		t.integer('userId').notNullable();
		t.string('firstName');
		t.string('lastName');
		t.string('department');
		t.string('division');
		t.string('branch');
		t.string('unit');
		t.string('email');
		t.string('mailcode');
		t.integer('daysNotTravel');
		t.date('dateBackToWork');
		t.integer('travelDuration');
		t.string('purpose');
		t.integer('travelAdvance');
		t.string('eventName');
		t.string('summary');
		t.string('formStatus');
		t.string('formId').notNullable().unique();
		t.string('supervisorEmail');
		t.integer('preappId');
		t.string('approved');
		t.string('requestChange');
		t.string('denialReason');
	});
};

exports.down = function (knex: knex.Knex, Promise: any) {
	return knex.schema.dropTable('forms');
};
