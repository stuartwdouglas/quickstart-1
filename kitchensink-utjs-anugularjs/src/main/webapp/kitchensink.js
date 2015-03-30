var Member = Java.type("org.jboss.as.quickstarts.kitchensink.model.Member");
var ConstraintViolationException = Java.type("javax.validation.ConstraintViolationException");
var NoResultException = Java.type("javax.persistence.NoResultException");

$undertow
    .wrapper(['jndi:java:comp/UserTransaction', function($exchange, $next, ut) {
        try {
            ut.begin();
            $next();
            ut.commit();
        } catch (e) {
            ut.rollback();
            throw e;
        }
    }])
    .wrapper([function($exchange, $next) {
        try {
            $next();
        } catch (e if e instanceof ConstraintViolationException) {
            $exchange.status(400);
            var results = {};
            var constraintViolations = Java.from(e.constraintViolations);
            for(i in  constraintViolations) {
                var cv = constraintViolations[i];
                results[cv.propertyPath] = cv.message;
            }
            $exchange.send(JSON.stringify(results));
        } catch (e) {
            $exchange.status(400);
            $exchange.send(JSON.stringify({"error": e.message}));
            throw e;
        }
    }])
    .onGet("/rest/members", ['cdi:em', function ($exchange, em) {
        $exchange.responseHeaders("content-type", "application/json");
        $exchange.send(JSON.stringify(em.createQuery("select m from Member m order by m.name").getResultList()));
    }])
    .onGet("/rest/members/{id}", ['cdi:em', function ($exchange, em) {
        print(Member.class)
        var member = em.find(Member.class, new java.lang.Long($exchange.param('id'))); //todo: we should be able to make this cleaner
        if (member == null) {
            $exchange.status(404);
        } else {
            $exchange.responseHeaders("content-type", "application/json");
            $exchange.send(JSON.stringify(member));
        }
    }])
    .onPost("/rest/members", ['$entity:json', 'cdi:memberRepository', "cdi:validator", function ($exchange, json, memberRepository, validator) {

        var member = $undertow.toJava(Member, json);
        try {
            memberRepository.findByEmail(member.email);
            $exchange.status(409);
            $exchange.send(JSON.stringify({"email": "Email already taken"}));
            return;
        } catch (e if e instanceof NoResultException) {}

        var violations = validator.validate(member);
        if (!violations.empty) {
            throw new ConstraintViolationException(violations);
        }
        //you could just use the entity manager directly here
        //this is just a demonstration of how you can call your java code
        memberRepository.save(member)
    }]);